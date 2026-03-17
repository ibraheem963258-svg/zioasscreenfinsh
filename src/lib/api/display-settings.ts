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

/**
 * Returns the effective display settings for a screen, resolving priority:
 * screen > group > branch > hardcoded defaults.
 *
 * Optimization: single OR query fetches all candidate rows in one round-trip
 * instead of the previous 3 sequential queries (screen → each group → branch).
 */
export async function getEffectiveDisplaySettings(
  screenId: string,
  groupIds: string[],
  branchId: string
): Promise<DisplaySettings> {
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

  // Build OR filter — one query covers all 3 levels simultaneously
  const orParts: string[] = [
    `target_type.eq.screen,target_id.eq.${screenId}`,
    `target_type.eq.branch,target_id.eq.${branchId}`,
  ];
  if (groupIds.length > 0) {
    orParts.push(`target_type.eq.group,target_id.in.(${groupIds.join(',')})`);
  }

  const { data: rows, error } = await supabase
    .from('display_settings')
    .select('*')
    .or(orParts.join(','));

  if (error) throw error;
  if (!rows?.length) return defaults;

  // Priority: screen(0) > group(1) > branch(2)
  const PRIORITY: Record<string, number> = { screen: 0, group: 1, branch: 2 };
  const best = rows.reduce((prev, cur) =>
    PRIORITY[cur.target_type] < PRIORITY[prev.target_type] ? cur : prev
  );

  return {
    id: best.id,
    targetType: best.target_type as 'screen' | 'group' | 'branch',
    targetId: best.target_id,
    slideDuration: best.slide_duration,
    transitionType: best.transition_type as 'none' | 'fade' | 'slide' | 'crossfade',
    transitionDuration: best.transition_duration,
    playbackOrder: best.playback_order as 'loop' | 'shuffle',
    contentScaling: best.content_scaling as 'fit' | 'fill' | 'stretch',
    createdAt: new Date(best.created_at),
    updatedAt: new Date(best.updated_at),
  };
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
