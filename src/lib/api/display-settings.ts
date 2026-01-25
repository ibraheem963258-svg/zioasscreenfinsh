import { supabase } from '@/integrations/supabase/client';
import { DisplaySettings } from '../types';

export async function getDisplaySettings(
  targetType: 'screen' | 'group' | 'branch',
  targetId: string
): Promise<DisplaySettings | null> {
  const { data, error } = await supabase
    .from('display_settings')
    .select('*')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .maybeSingle();
  
  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    targetType: data.target_type as 'screen' | 'group' | 'branch',
    targetId: data.target_id,
    slideDuration: data.slide_duration,
    transitionType: data.transition_type as 'none' | 'fade' | 'slide' | 'crossfade',
    transitionDuration: data.transition_duration,
    playbackOrder: data.playback_order as 'loop' | 'shuffle',
    contentScaling: data.content_scaling as 'fit' | 'fill' | 'stretch',
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

export async function getEffectiveDisplaySettings(
  screenId: string,
  groupIds: string[],
  branchId: string
): Promise<DisplaySettings> {
  // Default settings
  const defaults: DisplaySettings = {
    id: '',
    targetType: 'screen',
    targetId: screenId,
    slideDuration: 10,
    transitionType: 'fade',
    transitionDuration: 500,
    playbackOrder: 'loop',
    contentScaling: 'fill',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Try screen settings first
  const screenSettings = await getDisplaySettings('screen', screenId);
  if (screenSettings) return screenSettings;

  // Try group settings
  for (const groupId of groupIds) {
    const groupSettings = await getDisplaySettings('group', groupId);
    if (groupSettings) return groupSettings;
  }

  // Try branch settings
  const branchSettings = await getDisplaySettings('branch', branchId);
  if (branchSettings) return branchSettings;

  return defaults;
}

export async function upsertDisplaySettings(
  targetType: 'screen' | 'group' | 'branch',
  targetId: string,
  settings: Partial<Omit<DisplaySettings, 'id' | 'targetType' | 'targetId' | 'createdAt' | 'updatedAt'>>
): Promise<DisplaySettings> {
  const existingSettings = await getDisplaySettings(targetType, targetId);

  if (existingSettings) {
    const { data, error } = await supabase
      .from('display_settings')
      .update({
        slide_duration: settings.slideDuration ?? existingSettings.slideDuration,
        transition_type: settings.transitionType ?? existingSettings.transitionType,
        transition_duration: settings.transitionDuration ?? existingSettings.transitionDuration,
        playback_order: settings.playbackOrder ?? existingSettings.playbackOrder,
        content_scaling: settings.contentScaling ?? existingSettings.contentScaling,
      })
      .eq('id', existingSettings.id)
      .select()
      .single();
    
    if (error) throw error;

    return {
      id: data.id,
      targetType: data.target_type as 'screen' | 'group' | 'branch',
      targetId: data.target_id,
      slideDuration: data.slide_duration,
      transitionType: data.transition_type as 'none' | 'fade' | 'slide' | 'crossfade',
      transitionDuration: data.transition_duration,
      playbackOrder: data.playback_order as 'loop' | 'shuffle',
      contentScaling: data.content_scaling as 'fit' | 'fill' | 'stretch',
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  } else {
    const { data, error } = await supabase
      .from('display_settings')
      .insert({
        target_type: targetType,
        target_id: targetId,
        slide_duration: settings.slideDuration ?? 10,
        transition_type: settings.transitionType ?? 'fade',
        transition_duration: settings.transitionDuration ?? 500,
        playback_order: settings.playbackOrder ?? 'loop',
        content_scaling: settings.contentScaling ?? 'fill',
      })
      .select()
      .single();
    
    if (error) throw error;

    return {
      id: data.id,
      targetType: data.target_type as 'screen' | 'group' | 'branch',
      targetId: data.target_id,
      slideDuration: data.slide_duration,
      transitionType: data.transition_type as 'none' | 'fade' | 'slide' | 'crossfade',
      transitionDuration: data.transition_duration,
      playbackOrder: data.playback_order as 'loop' | 'shuffle',
      contentScaling: data.content_scaling as 'fit' | 'fill' | 'stretch',
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

export async function deleteDisplaySettings(
  targetType: 'screen' | 'group' | 'branch',
  targetId: string
): Promise<void> {
  const { error } = await supabase
    .from('display_settings')
    .delete()
    .eq('target_type', targetType)
    .eq('target_id', targetId);
  
  if (error) throw error;
}
