import { supabase } from '@/integrations/supabase/client';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: string;
  earned_at?: string;
}

export async function checkAndAwardBadges(userId: string) {
  try {
    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('streak')
      .eq('id', userId)
      .single();

    if (!profile) return;

    // Get user's current badges
    const { data: userBadges } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId);

    const earnedBadgeIds = userBadges?.map(ub => ub.badge_id) || [];

    // Get all badges
    const { data: allBadges } = await supabase
      .from('badges')
      .select('*');

    if (!allBadges) return;

    // Check which badges should be awarded
    const badgesToAward: string[] = [];

    for (const badge of allBadges) {
      if (earnedBadgeIds.includes(badge.id)) continue;

      switch (badge.requirement) {
        case 'first_meal':
          // Check if user has at least one meal
          const { count } = await supabase
            .from('meals')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);
          if (count && count > 0) {
            badgesToAward.push(badge.id);
          }
          break;

        case 'streak_3':
          if (profile.streak >= 3) {
            badgesToAward.push(badge.id);
          }
          break;

        case 'streak_7':
          if (profile.streak >= 7) {
            badgesToAward.push(badge.id);
          }
          break;

        case 'streak_30':
          if (profile.streak >= 30) {
            badgesToAward.push(badge.id);
          }
          break;
      }
    }

    // Award new badges
    if (badgesToAward.length > 0) {
      const badgeInserts = badgesToAward.map(badgeId => ({
        user_id: userId,
        badge_id: badgeId,
      }));

      await supabase.from('user_badges').insert(badgeInserts);

      return badgesToAward.length;
    }

    return 0;
  } catch (error) {
    console.error('Error checking badges:', error);
    return 0;
  }
}

export async function getUserBadges(userId: string): Promise<Badge[]> {
  try {
    const { data, error } = await supabase
      .from('user_badges')
      .select(`
        earned_at,
        badges (
          id,
          name,
          description,
          icon,
          requirement
        )
      `)
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });

    if (error) throw error;

    return data?.map(ub => ({
      ...(ub.badges as any),
      earned_at: ub.earned_at,
    })) || [];
  } catch (error) {
    console.error('Error fetching user badges:', error);
    return [];
  }
}
