import { supabase } from '../lib/supabase';


// Helper function to convert snake_case to camelCase
const toCamelCase = (obj) => {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj?.map(toCamelCase);
  if (typeof obj !== 'object') return obj;

  return Object.keys(obj)?.reduce((acc, key) => {
    // Special case: category maps to eventCategory for frontend consistency
    if (key === 'category') {
      acc['eventCategory'] = toCamelCase(obj?.[key]);
      return acc;
    }

    const camelKey = key?.replace(/_([a-z0-9])/gi, (_, letter) => letter?.toUpperCase());
    acc[camelKey] = toCamelCase(obj?.[key]);
    return acc;
  }, {});
};

// Helper function to convert camelCase to snake_case
const toSnakeCase = (obj) => {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj?.map(toSnakeCase);
  if (typeof obj !== 'object') return obj;

  return Object.keys(obj)?.reduce((acc, key) => {
    // Special case: eventCategory maps to category in database
    if (key === 'eventCategory') {
      acc['category'] = toSnakeCase(obj?.[key]);
      return acc;
    }
    
    const snakeKey = key?.replace(/[A-Z]/g, (letter) => `_${letter?.toLowerCase()}`);
    acc[snakeKey] = toSnakeCase(obj?.[key]);
    return acc;
  }, {});
};

export const attendanceService = {
  // Get all events
  async getEvents() {
    const { data, error } = await supabase?.from('events')?.select('*')?.order('date', { ascending: true });

    if (error) throw error;
    return toCamelCase(data);
  },

  // Get participants for a specific event
  async getEventParticipants(eventId) {
    const { data, error } = await supabase?.from('event_participants')?.select(`
        participant_id,
        participants (
          id,
          participant_id,
          name,
          has_allergies,
          allergies,
          has_medical_conditions,
          medical_notes,
          emergency_contact_name,
          emergency_contact_phone,
          emergency_contact_relationship
        )
      `)?.eq('event_id', eventId);

    if (error) throw error;

    // Flatten the structure and convert to camelCase
    const participants = data?.map(item => {
      const participant = item?.participants;
      return {
        ...participant,
        emergencyContact: {
          name: participant?.emergency_contact_name,
          phone: participant?.emergency_contact_phone,
          relationship: participant?.emergency_contact_relationship
        }
      };
    });
    return toCamelCase(participants);
  },

  // Get attendance records for a specific event
  async getAttendanceRecords(eventId) {
    const { data, error } = await supabase?.from('attendance_records')?.select('*')?.eq('event_id', eventId);

    if (error) throw error;
    return toCamelCase(data);
  },

  // Check in a participant
  async checkIn(eventId, participantId) {
    const { data, error } = await supabase?.from('attendance_records')?.upsert({
        event_id: eventId,
        participant_id: participantId,
        checked_in_at: new Date()?.toISOString(),
        checked_out_at: null
      }, {
        onConflict: 'event_id,participant_id'
      })?.select()?.single();

    if (error) throw error;
    return toCamelCase(data);
  },

  // Check out a participant
  async checkOut(eventId, participantId) {
    // Use upsert to handle case where record might not exist yet
    // (e.g., if user checks out before check-in delay completes)
    const { data, error } = await supabase?.from('attendance_records')?.upsert({
        event_id: eventId,
        participant_id: participantId,
        checked_in_at: new Date()?.toISOString(),
        checked_out_at: new Date()?.toISOString()
      }, {
        onConflict: 'event_id,participant_id'
      })?.select()?.single();

    if (error) throw error;
    return toCamelCase(data);
  },

  // Uncheck out a participant (remove checked_out_at timestamp)
  async uncheckOut(eventId, participantId) {
    const { data, error } = await supabase?.from('attendance_records')?.update({
        checked_out_at: null
      })?.eq('event_id', eventId)?.eq('participant_id', participantId)?.select()?.single();

    if (error) throw error;
    return toCamelCase(data);
  },

  // Delete attendance record
  async deleteAttendanceRecord(eventId, participantId) {
    console.log(`Attempting to delete attendance record: eventId=${eventId}, participantId=${participantId}`);
    
    const { error, count } = await supabase
      ?.from('attendance_records')
      ?.delete({ count: 'exact' })
      ?.eq('event_id', eventId)
      ?.eq('participant_id', participantId);

    if (error) {
      console.error('Delete attendance record error:', error);
      throw error;
    }
    
    console.log(`Successfully deleted ${count} attendance record(s)`);
  },

  // Remove check-out time (move from 'out' back to 'in')
  async removeCheckOut(eventId, participantId) {
    console.log(`Attempting to remove check-out: eventId=${eventId}, participantId=${participantId}`);
    
    const { data, error } = await supabase
      ?.from('attendance_records')
      ?.update({ checked_out_at: null })
      ?.eq('event_id', eventId)
      ?.eq('participant_id', participantId)
      ?.select();

    if (error) {
      console.error('Remove check-out error:', error);
      throw error;
    }
    
    console.log(`Successfully removed check-out for participant ${participantId}`);
    return toCamelCase(data?.[0]);
  },

  // Get all participants
  async getAllParticipants() {
    const { data, error } = await supabase
      ?.from('participants')
      ?.select('*')
      ?.order('first_name', { ascending: true });

    if (error) throw error;
    return toCamelCase(data);
  },

  // Bulk check in all participants for an event
  async bulkCheckIn(eventId, participantIds) {
    const records = participantIds?.map(participantId => ({
      event_id: eventId,
      participant_id: participantId,
      checked_in_at: new Date()?.toISOString()
    }));

    const { data, error } = await supabase?.from('attendance_records')?.upsert(records, { onConflict: 'event_id,participant_id' })?.select();

    if (error) throw error;
    return toCamelCase(data);
  },

  // Bulk check out all participants for an event
  async bulkCheckOut(eventId) {
    const { error } = await supabase?.from('attendance_records')?.delete()?.eq('event_id', eventId);

    if (error) throw error;
  },

  // Active Event Management
  // Create a new active event
  async createActiveEvent(eventData) {
    const snakeData = toSnakeCase(eventData);
    const { data, error } = await supabase
      ?.from('events')
      ?.insert({
        ...snakeData,
        is_active: true,
        created_at: new Date()?.toISOString(),
        updated_at: new Date()?.toISOString()
      })
      ?.select()
      ?.single();

    if (error) throw error;
    return toCamelCase(data);
  },

  // Get the current active event
  async getActiveEvent() {
    const { data, error } = await supabase
      ?.from('events')
      ?.select('*')
      ?.eq('is_active', true)
      ?.single();

    if (error) {
      if (error?.code === 'PGRST116') {
        // No active event found
        return null;
      }
      throw error;
    }
    return toCamelCase(data);
  },

  // Cancel active event (delete without archiving)
  async cancelActiveEvent(eventId) {
    // Delete the event and all associated data
    const { error } = await supabase
      ?.from('events')
      ?.delete()
      ?.eq('id', eventId)
      ?.eq('is_active', true);

    if (error) throw error;
  },

  // Log active event (archive it)
  async logActiveEvent(eventId, eventData) {
    const snakeData = toSnakeCase(eventData);
    const { data, error } = await supabase
      ?.from('events')
      ?.update({
        ...snakeData,
        is_active: false,
        updated_at: new Date()?.toISOString()
      })
      ?.eq('id', eventId)
      ?.eq('is_active', true)
      ?.select()
      ?.single();

    if (error) throw error;
    return toCamelCase(data);
  },

  // Update active event details
  async updateEvent(eventId, eventData) {
    const snakeData = toSnakeCase(eventData);
    const { data, error } = await supabase
      ?.from('events')
      ?.update({
        ...snakeData,
        updated_at: new Date()?.toISOString()
      })
      ?.eq('id', eventId)
      ?.select()
      ?.single();

    if (error) throw error;
    return toCamelCase(data);
  },

  // Create a new participant
  async createParticipant(participantData) {
    // Retry logic to handle race conditions
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Get next participant number from database function
        const { data: nextNumberData, error: fetchError } = await supabase
          ?.rpc('get_next_participant_number');

        if (fetchError) {
          console.error('Error fetching next participant number:', fetchError);
          throw fetchError;
        }

        let nextNumber = nextNumberData || 1;

        // Add random offset on retry to avoid collision
        if (attempt > 0) {
          nextNumber += Math.floor(Math.random() * 50) + (attempt * 20);
        }

        // Generate participant_id in format: KID2026XXX
        const year = new Date()?.getFullYear();
        const participantId = `KID${year}${String(nextNumber)?.padStart(3, '0')}`;

        console.log(`Attempt ${attempt + 1}: Generating participant_id: ${participantId}`);

        // Map form data to database columns
        const dbData = {
          participant_id: participantId,
          first_name: participantData?.firstName,
          last_name: participantData?.lastName,
          email: participantData?.email || null,
          phone: participantData?.phone || null,
          date_of_birth: participantData?.dateOfBirth || null,
          allergies_details: participantData?.allergies || null,
          has_allergies: !!participantData?.allergies,
          medical_condition_details: participantData?.medicalConditions || null,
          has_medical_conditions: !!participantData?.medicalConditions,
          emergency_contact_name: participantData?.ecName,
          emergency_contact_surname: participantData?.ecLastName,
          emergency_contact_email: participantData?.ecEmail || null,
          emergency_contact_phone: participantData?.ecPhone || null,
          emergency_contact_relationship_to_minor: participantData?.relationshipToMinor || null,
          media_consent_given: participantData?.mediaConsent || false,
          future_contact_permission_given: participantData?.futureContactConsent || false,
          emergency_treatment_consent_given: participantData?.emergencyTreatmentConsent || false,
          created_at: new Date()?.toISOString()
        };

        const { data, error } = await supabase
          ?.from('participants')
          ?.insert(dbData)
          ?.select()
          ?.single();

        if (error) {
          // Check if it's a duplicate key error
          if (error?.code === '23505' && error?.message?.includes('participant_id')) {
            lastError = error;
            console.warn(`Attempt ${attempt + 1}: Duplicate participant_id ${participantId}, retrying...`);
            // Retry with a different ID
            continue;
          }
          // Other errors should be thrown immediately
          console.error('Error creating participant:', error);
          throw error;
        }

        // Success - return the created participant
        console.log(`Successfully created participant with ID: ${participantId}`);
        return toCamelCase(data);
      } catch (error) {
        lastError = error;
        // If it's not a duplicate key error, throw immediately
        if (error?.code !== '23505' || !error?.message?.includes('participant_id')) {
          throw error;
        }
        // Otherwise, retry
        console.warn(`Attempt ${attempt + 1} failed with duplicate key, retrying...`);
      }
    }

    // If we've exhausted all retries, throw the last error
    console.error('Failed to create participant after multiple attempts:', lastError);
    throw new Error('Failed to create participant after multiple attempts. Please try again.');
  },

  // Log event with attendance records
  async logEvent(eventId, eventData, participantStages) {
    try {
      // Update event to mark as inactive and save notes
      const snakeData = toSnakeCase(eventData);
      const { data: updatedEvent, error: eventError } = await supabase
        ?.from('events')
        ?.update({
          ...snakeData,
          is_active: false,
          updated_at: new Date()?.toISOString()
        })
        ?.eq('id', eventId)
        ?.select()
        ?.single();

      if (eventError) throw eventError;

      // Create attendance records for all participants with 'in' or 'out' status
      const attendanceRecords = [];
      
      for (const [participantId, stage] of Object.entries(participantStages)) {
        if (stage === 'in' || stage === 'out') {
          const record = {
            event_id: eventId,
            participant_id: participantId,
            checked_in_at: new Date()?.toISOString(),
            checked_out_at: stage === 'out' ? new Date()?.toISOString() : null
          };
          attendanceRecords?.push(record);
        }
      }

      // Upsert all attendance records (update existing or insert new)
      if (attendanceRecords?.length > 0) {
        const { error: attendanceError } = await supabase
          ?.from('attendance_records')
          ?.upsert(attendanceRecords, {
            onConflict: 'event_id,participant_id'
          });

        if (attendanceError) throw attendanceError;
      }

      return toCamelCase(updatedEvent);
    } catch (error) {
      console.error('Error logging event:', error);
      throw error;
    }
  },

  // Get archived events with participant attendance data
  async getArchivedEvents() {
    const { data, error } = await supabase
      ?.from('events')
      ?.select(`
        *,
        attendance_records (
          id,
          checked_in_at,
          checked_out_at,
          participant:participants (
            id,
            participant_id,
            first_name,
            last_name,
            email,
            phone
          )
        )
      `)
      ?.eq('is_active', false)
      ?.order('event_date', { ascending: false });

    if (error) throw error;
    return toCamelCase(data);
  },

  // Update participant details
  async updateParticipant(participantId, participantData) {
    const dbData = {
      first_name: participantData?.firstName,
      last_name: participantData?.lastName,
      email: participantData?.email,
      phone: participantData?.phone,
      date_of_birth: participantData?.dateOfBirth || null,
      allergies_details: participantData?.allergies || null,
      has_allergies: !!participantData?.allergies,
      medical_condition_details: participantData?.medicalConditions || null,
      has_medical_conditions: !!participantData?.medicalConditions,
      emergency_contact_name: participantData?.ecName,
      emergency_contact_surname: participantData?.ecLastName,
      emergency_contact_email: participantData?.ecEmail,
      emergency_contact_phone: participantData?.ecPhone,
      emergency_contact_relationship_to_minor: participantData?.relationshipToMinor || null
    };

    const { data, error } = await supabase
      ?.from('participants')
      ?.update(dbData)
      ?.eq('id', participantId)
      ?.select()
      ?.single();

    if (error) {
      console.error('Error updating participant:', error);
      throw error;
    }
    return toCamelCase(data);
  },

  // Update participant consent fields
  async updateParticipantConsent(participantId, consentField, value) {
    // Map camelCase field names to snake_case database columns
    const fieldMapping = {
      mediaConsent: 'media_consent_given',
      futureContactConsent: 'future_contact_permission_given',
      emergencyTreatmentConsent: 'emergency_treatment_consent_given'
    };

    const dbField = fieldMapping?.[consentField];
    if (!dbField) {
      throw new Error(`Invalid consent field: ${consentField}`);
    }

    const { data, error } = await supabase
      ?.from('participants')
      ?.update({ [dbField]: value })
      ?.eq('id', participantId)
      ?.select()
      ?.single();

    if (error) {
      console.error('Error updating participant consent:', error);
      throw error;
    }
    return toCamelCase(data);
  },

  // Get participant attendance history
  async getParticipantAttendance(participantId) {
    const { data, error } = await supabase
      ?.from('attendance_records')
      ?.select(`
        id,
        checked_in_at,
        checked_out_at,
        event:events (
          id,
          event_name,
          event_date
        )
      `)
      ?.eq('participant_id', participantId)
      ?.order('checked_in_at', { ascending: false });

    if (error) throw error;
    return toCamelCase(data);
  },

  // Delete a participant permanently from the database
  async deleteParticipant(participantId) {
    // First delete related attendance records
    const { error: attendanceError } = await supabase
      ?.from('attendance_records')
      ?.delete()
      ?.eq('participant_id', participantId);

    if (attendanceError) {
      console.error('Error deleting attendance records:', attendanceError);
      throw attendanceError;
    }

    // Then delete the participant
    const { error } = await supabase
      ?.from('participants')
      ?.delete()
      ?.eq('id', participantId);

    if (error) {
      console.error('Error deleting participant:', error);
      throw error;
    }
  }
};