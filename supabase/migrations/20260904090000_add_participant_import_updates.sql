-- Secure, transactional preview/apply support for participant CSV updates.

CREATE OR REPLACE FUNCTION public.parse_participant_import_boolean(value_text TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(btrim(value_text))
    WHEN 'true' THEN true
    WHEN 'yes' THEN true
    WHEN 'y' THEN true
    WHEN '1' THEN true
    WHEN 'false' THEN false
    WHEN 'no' THEN false
    WHEN 'n' THEN false
    WHEN '0' THEN false
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.parse_participant_import_date(value_text TEXT)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  cleaned TEXT := btrim(value_text);
  date_parts TEXT[];
BEGIN
  IF cleaned ~ '^\d{4}-\d{2}-\d{2}$' THEN
    date_parts := string_to_array(cleaned, '-');
    RETURN make_date(date_parts[1]::INTEGER, date_parts[2]::INTEGER, date_parts[3]::INTEGER);
  ELSIF cleaned ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN
    date_parts := string_to_array(cleaned, '/');
    RETURN make_date(date_parts[3]::INTEGER, date_parts[2]::INTEGER, date_parts[1]::INTEGER);
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_participant_age()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN
    IF NEW.date_of_birth IS NOT NULL THEN
      NEW.age := public.calculate_age(NEW.date_of_birth);
      NEW.is_18_or_over := (NEW.age >= 18);
    ELSE
      NEW.age := NULL;
      NEW.is_18_or_over := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

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

  FOR input_row IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    processed_count := processed_count + 1;
    clean_updates := '{}'::JSONB;
    row_errors := '[]'::JSONB;
    row_warnings := '[]'::JSONB;
    changed_fields := '[]'::JSONB;
    resolved_id := NULL;

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

    -- Every nonblank matching identifier must resolve uniquely and agree.
    IF NULLIF(btrim(row_match->>'id'), '') IS NOT NULL THEN
      IF (row_match->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        row_errors := row_errors || jsonb_build_array('EventMe ID is not a valid UUID.');
      ELSE
        SELECT array_agg(id) INTO candidate_ids FROM public.participants WHERE id = (row_match->>'id')::UUID;
        IF COALESCE(array_length(candidate_ids, 1), 0) <> 1 THEN
          row_errors := row_errors || jsonb_build_array('EventMe ID did not match one participant.');
        ELSE
          resolved_id := candidate_ids[1];
        END IF;
      END IF;
    END IF;

    IF NULLIF(btrim(row_match->>'participant_id'), '') IS NOT NULL THEN
      SELECT array_agg(id) INTO candidate_ids
      FROM public.participants
      WHERE lower(btrim(participant_id)) = lower(btrim(row_match->>'participant_id'));
      IF COALESCE(array_length(candidate_ids, 1), 0) <> 1 THEN
        row_errors := row_errors || jsonb_build_array('Participant ID did not match one participant.');
      ELSIF resolved_id IS NOT NULL AND resolved_id <> candidate_ids[1] THEN
        row_errors := row_errors || jsonb_build_array('The supplied identifiers refer to different participants.');
      ELSE
        resolved_id := candidate_ids[1];
      END IF;
    END IF;

    IF NULLIF(btrim(row_match->>'email'), '') IS NOT NULL THEN
      SELECT array_agg(id) INTO candidate_ids
      FROM public.participants
      WHERE lower(btrim(email)) = lower(btrim(row_match->>'email'));
      IF COALESCE(array_length(candidate_ids, 1), 0) <> 1 THEN
        row_errors := row_errors || jsonb_build_array(
          CASE WHEN COALESCE(array_length(candidate_ids, 1), 0) > 1
            THEN 'Email matches more than one participant.' ELSE 'Email did not match a participant.' END
        );
      ELSIF resolved_id IS NOT NULL AND resolved_id <> candidate_ids[1] THEN
        row_errors := row_errors || jsonb_build_array('The supplied identifiers refer to different participants.');
      ELSE
        resolved_id := candidate_ids[1];
      END IF;
    END IF;

    IF NULLIF(btrim(row_match->>'first_name'), '') IS NOT NULL OR NULLIF(btrim(row_match->>'last_name'), '') IS NOT NULL THEN
      IF NULLIF(btrim(row_match->>'first_name'), '') IS NULL OR NULLIF(btrim(row_match->>'last_name'), '') IS NULL THEN
        row_errors := row_errors || jsonb_build_array('Both first and last name are required for name matching.');
      ELSE
        SELECT array_agg(id) INTO candidate_ids
        FROM public.participants
        WHERE lower(btrim(first_name)) = lower(btrim(row_match->>'first_name'))
          AND lower(btrim(last_name)) = lower(btrim(row_match->>'last_name'));
        IF COALESCE(array_length(candidate_ids, 1), 0) <> 1 THEN
          row_errors := row_errors || jsonb_build_array(
            CASE WHEN COALESCE(array_length(candidate_ids, 1), 0) > 1
              THEN 'Name matches more than one participant.' ELSE 'Name did not match a participant.' END
          );
        ELSIF resolved_id IS NOT NULL AND resolved_id <> candidate_ids[1] THEN
          row_errors := row_errors || jsonb_build_array('The supplied identifiers refer to different participants.');
        ELSE
          resolved_id := candidate_ids[1];
        END IF;
      END IF;
    END IF;

    IF resolved_id IS NULL AND jsonb_array_length(row_errors) = 0 THEN
      row_errors := row_errors || jsonb_build_array('No usable participant identifier was supplied.');
    END IF;

    IF resolved_id IS NOT NULL AND resolved_id = ANY(resolved_ids) THEN
      row_errors := row_errors || jsonb_build_array('Another CSV row already targets this participant.');
    ELSIF resolved_id IS NOT NULL THEN
      resolved_ids := array_append(resolved_ids, resolved_id);
    END IF;

    -- Whitelist and normalize update fields. Blank strings are deliberately ignored.
    FOR field_key IN SELECT jsonb_object_keys(row_updates)
    LOOP
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
          row_errors := row_errors || jsonb_build_array(field_key || ' is not a valid email address.');
        ELSE
          clean_updates := clean_updates || jsonb_build_object(field_key, lower(value_text));
        END IF;
      ELSIF field_key = 'role' THEN
        IF lower(value_text) NOT IN ('participant', 'volunteer', 'leader') THEN
          row_errors := row_errors || jsonb_build_array('Role must be Participant, Volunteer, or Leader.');
        ELSE
          clean_updates := clean_updates || jsonb_build_object(field_key, initcap(lower(value_text)));
        END IF;
      ELSIF field_key = 'date_of_birth' THEN
        parsed_date := public.parse_participant_import_date(value_text);
        IF parsed_date IS NULL OR parsed_date > CURRENT_DATE THEN
          row_errors := row_errors || jsonb_build_array('Date of birth must be a valid past date in YYYY-MM-DD or DD/MM/YYYY format.');
        ELSE
          clean_updates := clean_updates || jsonb_build_object(field_key, parsed_date::TEXT);
        END IF;
      ELSIF field_key = 'age' THEN
        IF value_text !~ '^\d{1,3}$' OR value_text::INTEGER > 120 THEN
          row_errors := row_errors || jsonb_build_array('Age must be a whole number from 0 to 120.');
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
          row_errors := row_errors || jsonb_build_array(field_key || ' must be yes/no, true/false, or 1/0.');
        ELSE
          clean_updates := clean_updates || jsonb_build_object(field_key, parsed_boolean);
        END IF;
      ELSE
        row_errors := row_errors || jsonb_build_array('Unsupported mapped field: ' || field_key || '.');
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
        row_errors := row_errors || jsonb_build_array('Age and 18-or-over values do not agree.');
      ELSIF NOT (clean_updates ? 'is_18_or_over') THEN
        clean_updates := clean_updates || jsonb_build_object('is_18_or_over', (clean_updates->>'age')::INTEGER >= 18);
      END IF;
    END IF;

    IF (clean_updates ? 'allergies_details') AND (clean_updates ? 'has_allergies')
      AND NOT (clean_updates->>'has_allergies')::BOOLEAN THEN
      row_errors := row_errors || jsonb_build_array('Allergy details cannot be supplied when Has allergies is false.');
    ELSIF (clean_updates ? 'allergies_details') AND NOT (clean_updates ? 'has_allergies') THEN
      clean_updates := clean_updates || jsonb_build_object('has_allergies', true);
    END IF;

    IF (clean_updates ? 'medical_condition_details') AND (clean_updates ? 'has_medical_conditions')
      AND NOT (clean_updates->>'has_medical_conditions')::BOOLEAN THEN
      row_errors := row_errors || jsonb_build_array('Medical details cannot be supplied when Has medical conditions is false.');
    ELSIF (clean_updates ? 'medical_condition_details') AND NOT (clean_updates ? 'has_medical_conditions') THEN
      clean_updates := clean_updates || jsonb_build_object('has_medical_conditions', true);
    END IF;

    IF resolved_id IS NOT NULL THEN
      IF p_dry_run THEN
        SELECT * INTO target FROM public.participants WHERE id = resolved_id;
      ELSE
        SELECT * INTO target FROM public.participants WHERE id = resolved_id FOR UPDATE;
        IF (NULLIF(btrim(row_match->>'id'), '') IS NOT NULL AND target.id::TEXT <> lower(btrim(row_match->>'id')))
          OR (NULLIF(btrim(row_match->>'participant_id'), '') IS NOT NULL AND lower(btrim(target.participant_id)) <> lower(btrim(row_match->>'participant_id')))
          OR (NULLIF(btrim(row_match->>'email'), '') IS NOT NULL AND lower(btrim(COALESCE(target.email, ''))) <> lower(btrim(row_match->>'email')))
          OR (NULLIF(btrim(row_match->>'first_name'), '') IS NOT NULL AND lower(btrim(COALESCE(target.first_name, ''))) <> lower(btrim(row_match->>'first_name')))
          OR (NULLIF(btrim(row_match->>'last_name'), '') IS NOT NULL AND lower(btrim(COALESCE(target.last_name, ''))) <> lower(btrim(row_match->>'last_name'))) THEN
          row_errors := row_errors || jsonb_build_array('Participant details changed after preview. Preview the import again.');
        END IF;
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
    ELSE
      matched_count := matched_count + 1;
      IF jsonb_array_length(changed_fields) > 0 THEN
        changed_count := changed_count + 1;
      ELSE
        unchanged_count := unchanged_count + 1;
      END IF;
      IF jsonb_array_length(changed_fields) > 0 THEN
        validated_rows := validated_rows || jsonb_build_array(jsonb_build_object(
          'row_number', row_number,
          'participant_id', resolved_id,
          'updates', clean_updates
        ));
      END IF;
    END IF;

    results := results || jsonb_build_array(jsonb_build_object(
      'row_number', row_number,
      'status', CASE WHEN jsonb_array_length(row_errors) > 0 THEN 'Invalid'
        WHEN jsonb_array_length(changed_fields) > 0 THEN 'Changed' ELSE 'Unchanged' END,
      'participant_id', resolved_id,
      'participant_name', CASE WHEN resolved_id IS NULL THEN NULL ELSE btrim(COALESCE(target.first_name, '') || ' ' || COALESCE(target.last_name, '')) END,
      'expected_version', CASE WHEN resolved_id IS NULL THEN NULL ELSE target_version END,
      'changed_fields', changed_fields,
      'warnings', row_warnings,
      'errors', row_errors
    ));
  END LOOP;

  IF invalid_count > 0 THEN
    RETURN jsonb_build_object(
      'ok', false, 'dry_run', p_dry_run, 'total_rows', row_count,
      'matched_rows', matched_count, 'changed_rows', changed_count,
      'unchanged_rows', unchanged_count, 'invalid_rows', invalid_count,
      'rows', results
    );
  END IF;

  IF NOT p_dry_run THEN
    FOR input_row IN SELECT value FROM jsonb_array_elements(validated_rows)
    LOOP
      clean_updates := input_row->'updates';
      IF clean_updates <> '{}'::JSONB THEN
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
    'unchanged_rows', unchanged_count, 'invalid_rows', 0,
    'rows', results
  );
END;
$$;

-- Keep participant audit entries useful without duplicating medical, Medicare,
-- contact, consent, or date-of-birth values into audit storage.
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  full_old JSONB := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  full_new JSONB := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  stored_old JSONB := full_old;
  stored_new JSONB := full_new;
  description TEXT := TG_TABLE_NAME || ' record ' || CASE TG_OP
    WHEN 'INSERT' THEN 'created' WHEN 'UPDATE' THEN 'updated' ELSE 'deleted' END;
  changed_fields_text TEXT;
  record_name_text TEXT;
  field_key TEXT;
  changes_array TEXT[] := ARRAY[]::TEXT[];
  significant_changes_count INTEGER := 0;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR field_key IN SELECT jsonb_object_keys(full_new)
    LOOP
      IF field_key NOT IN ('updated_at', 'created_at', 'id')
        AND (full_old->>field_key) IS DISTINCT FROM (full_new->>field_key) THEN
        IF field_key <> 'last_login_at' THEN
          significant_changes_count := significant_changes_count + 1;
        END IF;
        changes_array := array_append(
          changes_array,
          CASE WHEN TG_TABLE_NAME = 'participants' THEN field_key
            ELSE field_key || ': ' || COALESCE(full_old->>field_key, 'null') || ' → ' || COALESCE(full_new->>field_key, 'null') END
        );
      END IF;
    END LOOP;

    IF significant_changes_count = 0 THEN
      RETURN NEW;
    END IF;
    changed_fields_text := array_to_string(changes_array, ', ');
  ELSIF TG_OP = 'INSERT' THEN
    changed_fields_text := 'Record created';
  ELSE
    changed_fields_text := 'Record deleted';
  END IF;

  IF TG_TABLE_NAME = 'participants' THEN
    IF full_old IS NOT NULL THEN
      stored_old := jsonb_build_object(
        'id', full_old->'id', 'participant_id', full_old->'participant_id',
        'first_name', full_old->'first_name', 'last_name', full_old->'last_name'
      );
    END IF;
    IF full_new IS NOT NULL THEN
      stored_new := jsonb_build_object(
        'id', full_new->'id', 'participant_id', full_new->'participant_id',
        'first_name', full_new->'first_name', 'last_name', full_new->'last_name'
      );
    END IF;
    record_name_text := btrim(COALESCE(CASE WHEN TG_OP = 'DELETE' THEN OLD.first_name ELSE NEW.first_name END, '') || ' ' || COALESCE(CASE WHEN TG_OP = 'DELETE' THEN OLD.last_name ELSE NEW.last_name END, ''));
  ELSIF TG_TABLE_NAME = 'events' THEN
    record_name_text := CASE WHEN TG_OP = 'DELETE' THEN OLD.event_name ELSE NEW.event_name END;
  ELSIF TG_TABLE_NAME = 'user_profiles' THEN
    record_name_text := CASE WHEN TG_OP = 'DELETE' THEN OLD.full_name ELSE NEW.full_name END;
  ELSE
    record_name_text := 'Record #' || COALESCE(full_new->>'id', full_old->>'id', 'unknown');
  END IF;

  INSERT INTO public.audit_logs (
    table_name, record_id, action_type, old_values, new_values, changed_by,
    change_description, changed_fields, record_name
  ) VALUES (
    TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), TG_OP, stored_old, stored_new,
    auth.uid(), description, changed_fields_text, record_name_text
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "participants_update_authenticated" ON public.participants;
DROP POLICY IF EXISTS "participants_update_admin" ON public.participants;
CREATE POLICY "participants_update_admin"
ON public.participants
FOR UPDATE
TO authenticated
USING ((SELECT public.current_user_role()) IN ('admin', 'super_admin'))
WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'super_admin'));

REVOKE EXECUTE ON FUNCTION public.parse_participant_import_boolean(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.parse_participant_import_date(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_participant_age() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_participant_import(JSONB, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_participant_import(JSONB, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.process_participant_import(JSONB, BOOLEAN) IS
  'Validates and atomically previews or applies updates to existing participants for active admins.';
