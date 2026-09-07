-- Allow valid fields and eligible rows to import while retaining issues for review.
-- Existing audit privacy, role grants, and admin update policies remain in force.

CREATE OR REPLACE FUNCTION public.process_participant_import(
  p_rows JSONB,
  p_dry_run BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  input_row JSONB;
  row_match JSONB;
  row_updates JSONB;
  clean_updates JSONB;
  results JSONB := '[]'::JSONB;
  validated_rows JSONB := '[]'::JSONB;
  row_errors JSONB;
  row_warnings JSONB;
  changed_fields JSONB;
  candidate_ids UUID[];
  resolved_id UUID;
  resolved_ids UUID[] := ARRAY[]::UUID[];
  target public.participants%ROWTYPE;
  row_number INTEGER;
  row_count INTEGER;
  invalid_count INTEGER := 0;
  issue_count INTEGER := 0;
  changed_count INTEGER := 0;
  unchanged_count INTEGER := 0;
  matched_count INTEGER := 0;
  value_text TEXT;
  parsed_boolean BOOLEAN;
  parsed_date DATE;
  parsed_age INTEGER;
  field_key TEXT;
  processed_count INTEGER := 0;
  target_version TEXT;
  is_new BOOLEAN;
  new_count INTEGER := 0;
  new_names TEXT[] := ARRAY[]::TEXT[];
  new_emails TEXT[] := ARRAY[]::TEXT[];
  new_name TEXT;
  generated_number INTEGER;
  result_index INTEGER;
BEGIN
  IF ((SELECT public.current_user_role()) IN ('admin', 'super_admin')) IS NOT TRUE THEN
    RAISE EXCEPTION 'You do not have permission to import participant updates.' USING ERRCODE = '42501';
  END IF;

  IF p_dry_run IS NULL THEN
    RAISE EXCEPTION 'Preview or apply mode is required.' USING ERRCODE = '22023';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'Import rows must be supplied as an array.' USING ERRCODE = '22023';
  END IF;

  row_count := jsonb_array_length(p_rows);
  IF row_count = 0 THEN
    RAISE EXCEPTION 'The import must contain at least one data row.' USING ERRCODE = '22023';
  ELSIF row_count > 5000 THEN
    RAISE EXCEPTION 'The import cannot contain more than 5000 data rows.' USING ERRCODE = '22023';
  END IF;

  -- Serialize apply against all participant writers, including ordinary create,
  -- before rechecking identity and generating a participant number.
  IF NOT p_dry_run THEN
    LOCK TABLE public.participants IN SHARE ROW EXCLUSIVE MODE;
  END IF;

  FOR input_row IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    processed_count := processed_count + 1;
    clean_updates := '{}'::JSONB;
    row_errors := '[]'::JSONB;
    row_warnings := '[]'::JSONB;
    changed_fields := '[]'::JSONB;
    resolved_id := NULL;
    target := NULL;
    target_version := NULL;
    is_new := false;

    IF jsonb_typeof(input_row) <> 'object' THEN
      row_errors := row_errors || jsonb_build_array('The row has an invalid import structure.');
      input_row := '{}'::JSONB;
    END IF;

    IF COALESCE(input_row->>'row_number', '') ~ '^\d{1,7}$' THEN
      row_number := (input_row->>'row_number')::INTEGER;
    ELSE
      row_number := processed_count + 1;
      row_errors := row_errors || jsonb_build_array('The CSV row number is invalid.');
    END IF;

    row_match := COALESCE(input_row->'match', '{}'::JSONB);
    row_updates := COALESCE(input_row->'updates', '{}'::JSONB);

    IF jsonb_typeof(row_match) <> 'object' THEN
      row_errors := row_errors || jsonb_build_array('The row has an invalid match structure.');
      row_match := '{}'::JSONB;
    END IF;
    IF jsonb_typeof(row_updates) <> 'object' THEN
      row_errors := row_errors || jsonb_build_array('The row has an invalid updates structure.');
      row_updates := '{}'::JSONB;
    END IF;

    -- Unique matches must agree. Unmatched identifiers are warnings so an
    -- invalid/new email does not prevent a participant-ID or name match.
    FOR field_key IN SELECT unnest(ARRAY['id', 'participant_id', 'email', 'name'])
    LOOP
      candidate_ids := ARRAY[]::UUID[];
      IF field_key = 'name' THEN
        IF NULLIF(btrim(row_match->>'first_name'), '') IS NULL
          AND NULLIF(btrim(row_match->>'last_name'), '') IS NULL THEN CONTINUE; END IF;
        IF NULLIF(btrim(row_match->>'first_name'), '') IS NULL
          OR NULLIF(btrim(row_match->>'last_name'), '') IS NULL THEN
          row_warnings := row_warnings || jsonb_build_array('Name matching requires both first and last name; this identifier was ignored.');
          CONTINUE;
        END IF;
        SELECT array_agg(id) INTO candidate_ids FROM public.participants
          WHERE lower(btrim(first_name)) = lower(btrim(row_match->>'first_name'))
            AND lower(btrim(last_name)) = lower(btrim(row_match->>'last_name'));
      ELSE
        value_text := NULLIF(btrim(row_match->>field_key), '');
        IF value_text IS NULL THEN CONTINUE; END IF;
        IF field_key = 'id' THEN
          IF value_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
            row_warnings := row_warnings || jsonb_build_array('EventMe ID is not a valid UUID; this identifier was ignored.');
            CONTINUE;
          END IF;
          SELECT array_agg(id) INTO candidate_ids FROM public.participants WHERE id = value_text::UUID;
        ELSIF field_key = 'participant_id' THEN
          SELECT array_agg(id) INTO candidate_ids FROM public.participants WHERE lower(btrim(participant_id)) = lower(value_text);
        ELSE
          SELECT array_agg(id) INTO candidate_ids FROM public.participants WHERE lower(btrim(email)) = lower(value_text);
        END IF;
      END IF;
      IF COALESCE(array_length(candidate_ids, 1), 0) = 0 THEN
        row_warnings := row_warnings || jsonb_build_array(field_key || ' did not match a participant; this identifier was ignored.');
      ELSIF array_length(candidate_ids, 1) > 1 THEN
        row_errors := row_errors || jsonb_build_array(field_key || ' matches more than one participant. This row was skipped.');
      ELSIF resolved_id IS NOT NULL AND resolved_id <> candidate_ids[1] THEN
        row_errors := row_errors || jsonb_build_array('The supplied identifiers refer to different participants. This row was skipped.');
      ELSE
        resolved_id := candidate_ids[1];
      END IF;
    END LOOP;



    IF resolved_id IS NOT NULL AND resolved_id = ANY(resolved_ids) THEN
      row_errors := row_errors || jsonb_build_array('Another CSV row already targets this participant.');
    ELSIF resolved_id IS NOT NULL THEN
      resolved_ids := array_append(resolved_ids, resolved_id);
    END IF;

    -- Whitelist and normalize update fields. Blank strings are deliberately ignored.
    FOR field_key IN SELECT jsonb_object_keys(row_updates)
    LOOP
      IF jsonb_typeof(row_updates->field_key) IN ('object', 'array') THEN
        row_warnings := row_warnings || jsonb_build_array(field_key || ' has an invalid value and was skipped; the existing value was kept.');
        CONTINUE;
      END IF;
      value_text := btrim(row_updates->>field_key);
      IF value_text IS NULL OR value_text = '' THEN
        CONTINUE;
      END IF;

      IF field_key IN (
        'first_name', 'last_name', 'phone', 'allergies_details', 'medical_condition_details',
        'medicare', 'emergency_contact_name', 'emergency_contact_surname',
        'emergency_contact_phone', 'emergency_contact_relationship_to_minor',
        'person_to_go_home_with', 'notes'
      ) THEN
        clean_updates := clean_updates || jsonb_build_object(field_key, value_text);
      ELSIF field_key IN ('email', 'emergency_contact_email') THEN
        IF value_text !~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$' THEN
          row_warnings := row_warnings || jsonb_build_array(field_key || ' is not a valid email address; the field was skipped; the existing value was kept.');
        ELSE
          clean_updates := clean_updates || jsonb_build_object(field_key, lower(value_text));
        END IF;
      ELSIF field_key = 'role' THEN
        IF lower(value_text) NOT IN ('participant', 'volunteer', 'leader') THEN
          row_warnings := row_warnings || jsonb_build_array('Role must be Participant, Volunteer, or Leader; the field was skipped; the existing value was kept.');
        ELSE
          clean_updates := clean_updates || jsonb_build_object(field_key, initcap(lower(value_text)));
        END IF;
      ELSIF field_key = 'date_of_birth' THEN
        parsed_date := public.parse_participant_import_date(value_text);
        IF parsed_date IS NULL OR parsed_date > CURRENT_DATE THEN
          row_warnings := row_warnings || jsonb_build_array('Date of birth must be a valid past date in YYYY-MM-DD or DD/MM/YYYY format; the field was skipped; the existing value was kept.');
        ELSE
          clean_updates := clean_updates || jsonb_build_object(field_key, parsed_date::TEXT);
        END IF;
      ELSIF field_key = 'age' THEN
        IF value_text !~ '^\d{1,3}$' OR value_text::INTEGER > 120 THEN
          row_warnings := row_warnings || jsonb_build_array('Age must be a whole number from 0 to 120; the field was skipped; the existing value was kept.');
        ELSE
          parsed_age := value_text::INTEGER;
          clean_updates := clean_updates || jsonb_build_object(field_key, parsed_age);
        END IF;
      ELSIF field_key IN (
        'is_18_or_over', 'has_allergies', 'has_medical_conditions', 'form_received',
        'media_consent_given', 'emergency_treatment_consent_given',
        'future_contact_permission_given', 'self_sign_out_permission'
      ) THEN
        parsed_boolean := public.parse_participant_import_boolean(value_text);
        IF parsed_boolean IS NULL THEN
          row_warnings := row_warnings || jsonb_build_array(field_key || ' must be yes/no, true/false, or 1/0; the field was skipped; the existing value was kept.');
        ELSE
          clean_updates := clean_updates || jsonb_build_object(field_key, parsed_boolean);
        END IF;
      ELSE
        row_warnings := row_warnings || jsonb_build_array('Unsupported mapped field: ' || field_key || '.');
      END IF;
    END LOOP;

    IF (clean_updates ? 'date_of_birth') THEN
      IF (clean_updates ? 'age') OR (clean_updates ? 'is_18_or_over') THEN
        row_warnings := row_warnings || jsonb_build_array('Age and 18-or-over are calculated from date of birth.');
      END IF;
      clean_updates := clean_updates - 'age' - 'is_18_or_over';
    END IF;

    IF (clean_updates ? 'age') THEN
      IF (clean_updates ? 'is_18_or_over')
        AND (clean_updates->>'is_18_or_over')::BOOLEAN <> ((clean_updates->>'age')::INTEGER >= 18) THEN
        row_warnings := row_warnings || jsonb_build_array('Age and 18-or-over values do not agree; both fields were skipped; the existing values were kept.');
        clean_updates := clean_updates - 'age' - 'is_18_or_over';
      ELSIF NOT (clean_updates ? 'is_18_or_over') THEN
        clean_updates := clean_updates || jsonb_build_object('is_18_or_over', (clean_updates->>'age')::INTEGER >= 18);
      END IF;
    END IF;

    IF (clean_updates ? 'allergies_details') AND (clean_updates ? 'has_allergies')
      AND NOT (clean_updates->>'has_allergies')::BOOLEAN THEN
      row_warnings := row_warnings || jsonb_build_array('Allergy details conflict with Has allergies; both fields were skipped; the existing values were kept.');
      clean_updates := clean_updates - 'allergies_details' - 'has_allergies';
    ELSIF (clean_updates ? 'allergies_details') AND NOT (clean_updates ? 'has_allergies') THEN
      clean_updates := clean_updates || jsonb_build_object('has_allergies', true);
    END IF;

    IF (clean_updates ? 'medical_condition_details') AND (clean_updates ? 'has_medical_conditions')
      AND NOT (clean_updates->>'has_medical_conditions')::BOOLEAN THEN
      row_warnings := row_warnings || jsonb_build_array('Medical details conflict with Has medical conditions; both fields were skipped; the existing values were kept.');
      clean_updates := clean_updates - 'medical_condition_details' - 'has_medical_conditions';
    ELSIF (clean_updates ? 'medical_condition_details') AND NOT (clean_updates ? 'has_medical_conditions') THEN
      clean_updates := clean_updates || jsonb_build_object('has_medical_conditions', true);
    END IF;

    IF resolved_id IS NULL AND jsonb_array_length(row_errors) = 0 THEN
      IF (input_row->'allow_create') IS DISTINCT FROM 'true'::JSONB THEN
        row_errors := row_errors || jsonb_build_array('This import has not enabled new participants. Reload the page and preview again.');
      ELSIF NULLIF(clean_updates->>'first_name', '') IS NULL OR NULLIF(clean_updates->>'last_name', '') IS NULL THEN
        row_errors := row_errors || jsonb_build_array('A new participant requires both first and last name. This row was skipped.');
      ELSE
        is_new := true;
        -- An unmatched identifier is expected for a new participant, not a
        -- problem. Preserve validation and missing-contact warnings.
        SELECT COALESCE(jsonb_agg(value), '[]'::JSONB) INTO row_warnings
          FROM jsonb_array_elements(row_warnings)
          WHERE value #>> '{}' NOT LIKE '% did not match a participant; this identifier was ignored.';
        IF NULLIF(clean_updates->>'emergency_contact_name', '') IS NULL OR NULLIF(clean_updates->>'emergency_contact_phone', '') IS NULL THEN
          row_warnings := row_warnings || jsonb_build_array('Emergency contact name or phone is missing. Add the contact details after import.');
        END IF;
        new_name := lower(btrim(clean_updates->>'first_name')) || chr(31) || lower(btrim(clean_updates->>'last_name'));
        -- Even direct RPC callers cannot omit matching names/email to create a
        -- duplicate of an existing participant.
        IF EXISTS (SELECT 1 FROM public.participants WHERE
          (lower(btrim(first_name)) = lower(clean_updates->>'first_name') AND lower(btrim(last_name)) = lower(clean_updates->>'last_name'))
          OR (NULLIF(clean_updates->>'email', '') IS NOT NULL AND lower(btrim(email)) = lower(clean_updates->>'email'))) THEN
          row_errors := row_errors || jsonb_build_array('A participant with this name or email now exists. Preview again to match them.');
        ELSIF new_name = ANY(new_names) OR (NULLIF(clean_updates->>'email', '') IS NOT NULL AND lower(clean_updates->>'email') = ANY(new_emails)) THEN
          row_errors := row_errors || jsonb_build_array('Another CSV row already creates this participant. This row was skipped.');
        ELSE
          new_names := array_append(new_names, new_name);
          IF NULLIF(clean_updates->>'email', '') IS NOT NULL THEN
            new_emails := array_append(new_emails, lower(clean_updates->>'email'));
          END IF;
        END IF;
        target_version := 'new:' || md5((input_row - 'expected_version')::TEXT);
        IF NOT p_dry_run AND (input_row->>'expected_version') IS DISTINCT FROM target_version THEN
          row_errors := row_errors || jsonb_build_array('This new participant was not approved in the preview. Preview again.');
        END IF;
        changed_fields := to_jsonb(ARRAY(SELECT jsonb_object_keys(clean_updates)));
      END IF;
    END IF;

    IF resolved_id IS NOT NULL THEN
      IF p_dry_run THEN
        SELECT * INTO target FROM public.participants WHERE id = resolved_id;
      ELSE
        SELECT * INTO target FROM public.participants WHERE id = resolved_id FOR UPDATE;
      END IF;
      IF NOT FOUND THEN
        row_errors := row_errors || jsonb_build_array('The matched participant no longer exists. Preview the import again.');
      END IF;

      target_version := md5(to_jsonb(target)::TEXT);
      IF NOT p_dry_run AND NULLIF(input_row->>'expected_version', '') IS DISTINCT FROM target_version THEN
        row_errors := row_errors || jsonb_build_array('Participant details changed after preview. Preview the import again.');
      END IF;

      IF target.date_of_birth IS NOT NULL AND NOT (clean_updates ? 'date_of_birth')
        AND ((clean_updates ? 'age') OR (clean_updates ? 'is_18_or_over')) THEN
        clean_updates := clean_updates - 'age' - 'is_18_or_over';
        row_warnings := row_warnings || jsonb_build_array('Age and 18-or-over remain calculated from the existing date of birth.');
      END IF;
      FOR field_key IN SELECT jsonb_object_keys(clean_updates)
      LOOP
        IF (to_jsonb(target)->field_key) IS DISTINCT FROM (clean_updates->field_key) THEN
          changed_fields := changed_fields || jsonb_build_array(field_key);
        END IF;
      END LOOP;
    END IF;

    IF jsonb_array_length(row_errors) > 0 THEN
      invalid_count := invalid_count + 1;
      changed_fields := '[]'::JSONB;
    ELSE
      IF is_new THEN
        new_count := new_count + 1;
      ELSE
        matched_count := matched_count + 1;
      END IF;
      IF is_new THEN
        NULL;
      ELSIF jsonb_array_length(changed_fields) > 0 THEN
        changed_count := changed_count + 1;
      ELSE
        unchanged_count := unchanged_count + 1;
      END IF;
      IF jsonb_array_length(changed_fields) > 0 THEN
        validated_rows := validated_rows || jsonb_build_array(jsonb_build_object(
          'row_number', row_number,
          'result_index', processed_count - 1,
          'action', CASE WHEN is_new THEN 'create' ELSE 'update' END,
          'participant_id', resolved_id,
          'updates', clean_updates
        ));
      END IF;
    END IF;

    IF jsonb_array_length(row_errors) > 0 OR jsonb_array_length(row_warnings) > 0 THEN
      issue_count := issue_count + 1;
    END IF;

    results := results || jsonb_build_array(jsonb_build_object(
      'row_number', row_number,
      'status', CASE WHEN jsonb_array_length(row_errors) > 0 THEN 'Skipped'
        WHEN is_new THEN 'New'
        WHEN jsonb_array_length(row_warnings) > 0 THEN 'Warning'
        WHEN jsonb_array_length(changed_fields) > 0 THEN 'Changed' ELSE 'Unchanged' END,
      'action', CASE WHEN is_new THEN 'create' ELSE 'update' END,
      'participant_id', resolved_id,
      'participant_name', CASE WHEN is_new THEN btrim((clean_updates->>'first_name') || ' ' || (clean_updates->>'last_name')) WHEN resolved_id IS NULL THEN NULL ELSE btrim(COALESCE(target.first_name, '') || ' ' || COALESCE(target.last_name, '')) END,
      -- Skipped rows never receive an apply token, even if their conflict is
      -- resolved elsewhere between preview and apply.
      'expected_version', CASE WHEN jsonb_array_length(row_errors) > 0 THEN NULL ELSE target_version END,
      'changed_fields', changed_fields,
      'warnings', row_warnings,
      'errors', row_errors
    ));
  END LOOP;

  -- A creation must also be distinct from the final identities of eligible
  -- updates in this batch, regardless of CSV row order.
  FOR input_row IN SELECT value FROM jsonb_array_elements(validated_rows) WHERE value->>'action' = 'create'
  LOOP
    clean_updates := input_row->'updates';
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(validated_rows) AS plan(value)
      JOIN public.participants p ON p.id = (plan.value->>'participant_id')::UUID
      WHERE plan.value->>'action' = 'update' AND (
        (lower(btrim(COALESCE(plan.value->'updates'->>'first_name', p.first_name))) = lower(clean_updates->>'first_name')
          AND lower(btrim(COALESCE(plan.value->'updates'->>'last_name', p.last_name))) = lower(clean_updates->>'last_name'))
        OR (NULLIF(clean_updates->>'email', '') IS NOT NULL
          AND lower(btrim(COALESCE(plan.value->'updates'->>'email', p.email))) = lower(clean_updates->>'email'))
      )
    ) THEN
      result_index := (input_row->>'result_index')::INTEGER;
      IF jsonb_array_length(results->result_index->'warnings') = 0 THEN
        issue_count := issue_count + 1;
      END IF;
      results := jsonb_set(results, ARRAY[result_index::TEXT], (results->result_index) || jsonb_build_object(
        'status', 'Skipped', 'expected_version', NULL, 'changed_fields', '[]'::JSONB,
        'errors', jsonb_build_array('Another row updates an existing participant to this name or email. This new row was skipped.')
      ));
      new_count := new_count - 1;
      invalid_count := invalid_count + 1;
      SELECT COALESCE(jsonb_agg(value), '[]'::JSONB) INTO validated_rows
        FROM jsonb_array_elements(validated_rows) WHERE (value->>'result_index')::INTEGER <> result_index;
    END IF;
  END LOOP;

  IF NOT p_dry_run THEN
    FOR input_row IN SELECT value FROM jsonb_array_elements(validated_rows)
    LOOP
      clean_updates := input_row->'updates';
      IF input_row->>'action' = 'create' THEN
        generated_number := public.get_next_participant_number();
        clean_updates := jsonb_build_object(
          'role', 'Participant', 'emergency_contact_name', '',
          'emergency_contact_phone', NULL, 'emergency_contact_relationship_to_minor', NULL,
          'is_18_or_over', false, 'has_allergies', false, 'has_medical_conditions', false, 'form_received', false, 'media_consent_given', false, 'emergency_treatment_consent_given', false, 'future_contact_permission_given', false, 'self_sign_out_permission', false
        ) || clean_updates;
        INSERT INTO public.participants (participant_id, first_name, last_name, email, phone, role, date_of_birth, age, is_18_or_over, has_allergies, allergies_details, has_medical_conditions, medical_condition_details, medicare, emergency_contact_name, emergency_contact_surname, emergency_contact_email, emergency_contact_phone, emergency_contact_relationship_to_minor, person_to_go_home_with, form_received, media_consent_given, emergency_treatment_consent_given, future_contact_permission_given, self_sign_out_permission, notes)
        SELECT 'KID' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || lpad(generated_number::TEXT, greatest(3,length(generated_number::TEXT)), '0'),
          r.first_name, r.last_name, r.email, r.phone, r.role, r.date_of_birth, r.age, r.is_18_or_over, r.has_allergies, r.allergies_details, r.has_medical_conditions, r.medical_condition_details, r.medicare, r.emergency_contact_name, r.emergency_contact_surname, r.emergency_contact_email, r.emergency_contact_phone, r.emergency_contact_relationship_to_minor, r.person_to_go_home_with, r.form_received, r.media_consent_given, r.emergency_treatment_consent_given, r.future_contact_permission_given, r.self_sign_out_permission, r.notes
        FROM jsonb_populate_record(NULL::public.participants, clean_updates) AS r
        RETURNING * INTO target;
        -- The existing insert trigger derives age from DOB and clears explicit
        -- age when DOB is absent. Preserve validated CSV age/adult values.
        IF target.date_of_birth IS NULL AND ((clean_updates ? 'age') OR (clean_updates ? 'is_18_or_over')) THEN
          UPDATE public.participants SET age = (clean_updates->>'age')::INTEGER,
            is_18_or_over = COALESCE((clean_updates->>'is_18_or_over')::BOOLEAN, false)
            WHERE id = target.id RETURNING * INTO target;
        END IF;
        result_index := (input_row->>'result_index')::INTEGER;
        results := jsonb_set(results, ARRAY[result_index::TEXT], (results->result_index) || jsonb_build_object(
          'participant_id', target.id, 'generated_participant_id', target.participant_id,
          'participant_name', btrim(target.first_name || ' ' || target.last_name)
        ));
      ELSIF clean_updates <> '{}'::JSONB THEN
        UPDATE public.participants
        SET
          first_name = CASE WHEN clean_updates ? 'first_name' THEN clean_updates->>'first_name' ELSE first_name END,
          last_name = CASE WHEN clean_updates ? 'last_name' THEN clean_updates->>'last_name' ELSE last_name END,
          email = CASE WHEN clean_updates ? 'email' THEN clean_updates->>'email' ELSE email END,
          phone = CASE WHEN clean_updates ? 'phone' THEN clean_updates->>'phone' ELSE phone END,
          role = CASE WHEN clean_updates ? 'role' THEN clean_updates->>'role' ELSE role END,
          date_of_birth = CASE WHEN clean_updates ? 'date_of_birth' THEN (clean_updates->>'date_of_birth')::DATE ELSE date_of_birth END,
          age = CASE WHEN clean_updates ? 'age' THEN (clean_updates->>'age')::INTEGER ELSE age END,
          is_18_or_over = CASE WHEN clean_updates ? 'is_18_or_over' THEN (clean_updates->>'is_18_or_over')::BOOLEAN ELSE is_18_or_over END,
          has_allergies = CASE WHEN clean_updates ? 'has_allergies' THEN (clean_updates->>'has_allergies')::BOOLEAN ELSE has_allergies END,
          allergies_details = CASE WHEN clean_updates ? 'allergies_details' THEN clean_updates->>'allergies_details' ELSE allergies_details END,
          has_medical_conditions = CASE WHEN clean_updates ? 'has_medical_conditions' THEN (clean_updates->>'has_medical_conditions')::BOOLEAN ELSE has_medical_conditions END,
          medical_condition_details = CASE WHEN clean_updates ? 'medical_condition_details' THEN clean_updates->>'medical_condition_details' ELSE medical_condition_details END,
          medicare = CASE WHEN clean_updates ? 'medicare' THEN clean_updates->>'medicare' ELSE medicare END,
          emergency_contact_name = CASE WHEN clean_updates ? 'emergency_contact_name' THEN clean_updates->>'emergency_contact_name' ELSE emergency_contact_name END,
          emergency_contact_surname = CASE WHEN clean_updates ? 'emergency_contact_surname' THEN clean_updates->>'emergency_contact_surname' ELSE emergency_contact_surname END,
          emergency_contact_email = CASE WHEN clean_updates ? 'emergency_contact_email' THEN clean_updates->>'emergency_contact_email' ELSE emergency_contact_email END,
          emergency_contact_phone = CASE WHEN clean_updates ? 'emergency_contact_phone' THEN clean_updates->>'emergency_contact_phone' ELSE emergency_contact_phone END,
          emergency_contact_relationship_to_minor = CASE WHEN clean_updates ? 'emergency_contact_relationship_to_minor' THEN clean_updates->>'emergency_contact_relationship_to_minor' ELSE emergency_contact_relationship_to_minor END,
          person_to_go_home_with = CASE WHEN clean_updates ? 'person_to_go_home_with' THEN clean_updates->>'person_to_go_home_with' ELSE person_to_go_home_with END,
          form_received = CASE WHEN clean_updates ? 'form_received' THEN (clean_updates->>'form_received')::BOOLEAN ELSE form_received END,
          media_consent_given = CASE WHEN clean_updates ? 'media_consent_given' THEN (clean_updates->>'media_consent_given')::BOOLEAN ELSE media_consent_given END,
          emergency_treatment_consent_given = CASE WHEN clean_updates ? 'emergency_treatment_consent_given' THEN (clean_updates->>'emergency_treatment_consent_given')::BOOLEAN ELSE emergency_treatment_consent_given END,
          future_contact_permission_given = CASE WHEN clean_updates ? 'future_contact_permission_given' THEN (clean_updates->>'future_contact_permission_given')::BOOLEAN ELSE future_contact_permission_given END,
          self_sign_out_permission = CASE WHEN clean_updates ? 'self_sign_out_permission' THEN (clean_updates->>'self_sign_out_permission')::BOOLEAN ELSE self_sign_out_permission END,
          notes = CASE WHEN clean_updates ? 'notes' THEN clean_updates->>'notes' ELSE notes END
        WHERE id = (input_row->>'participant_id')::UUID;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'dry_run', p_dry_run, 'total_rows', row_count,
    'matched_rows', matched_count, 'changed_rows', changed_count,
    'updated_rows', CASE WHEN p_dry_run THEN 0 ELSE changed_count END,
    'new_rows', new_count, 'created_rows', CASE WHEN p_dry_run THEN 0 ELSE new_count END,
    'unchanged_rows', unchanged_count, 'invalid_rows', invalid_count,
    'skipped_rows', invalid_count, 'issue_rows', issue_count,
    'rows', results
  );
END;
$$;

COMMENT ON FUNCTION public.process_participant_import(JSONB, BOOLEAN) IS 'Previews and atomically imports eligible existing and new participants for active admins.';
