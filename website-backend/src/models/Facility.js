const { supabase } = require('../config/supabase');

class Facility {
  static async findAll() {
    const { data, error } = await supabase
      .from('facilities')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async findById(id) {
    const { data, error } = await supabase
      .from('facilities')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  static async create(facilityData) {
    const { data, error } = await supabase
      .from('facilities')
      .insert([facilityData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async update(id, updateData) {
    const { data, error } = await supabase
      .from('facilities')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async delete(id) {
    const { error } = await supabase
      .from('facilities')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  static async count() {
    const { count, error } = await supabase
      .from('facilities')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    return count;
  }
}

module.exports = Facility;
