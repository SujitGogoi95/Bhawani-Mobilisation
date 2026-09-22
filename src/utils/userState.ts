import { User } from '../types';
import { getStateForDistrict } from './locationData';

/**
 * Automatically identifies and returns the assigned State for a user profile.
 * - Admin returns null (no restriction, can manage all states).
 * - State mobilisers return their strictly assigned state ('Nagaland', 'Meghalaya', 'Assam', 'Manipur').
 * 
 * Dynamically resolves from:
 * 1. user.state property
 * 2. Profile name pattern e.g. "Mobiliser (Nagaland)"
 * 3. Profile email pattern e.g. "mobiliser.nagaland@..."
 * 4. Assigned district mapping fallback
 */
export function getUserAssignedState(user?: User | null): string | null {
  if (!user) return null;
  if (user.role === 'admin') return null;

  // 1. Direct user.state property
  if (user.state && user.state !== 'All' && user.state !== 'All States') {
    return user.state.trim();
  }

  // 2. Profile display name matching: "Mobiliser (Nagaland)"
  if (user.name) {
    const match = user.name.match(/\((Nagaland|Meghalaya|Assam|Manipur)\)/i);
    if (match && match[1]) {
      // Return normalized title case
      const raw = match[1].toLowerCase();
      if (raw === 'nagaland') return 'Nagaland';
      if (raw === 'meghalaya') return 'Meghalaya';
      if (raw === 'assam') return 'Assam';
      if (raw === 'manipur') return 'Manipur';
    }
  }

  // 3. User email matching fallback
  if (user.email) {
    const emailLower = user.email.toLowerCase();
    if (emailLower.includes('nagaland')) return 'Nagaland';
    if (emailLower.includes('meghalaya')) return 'Meghalaya';
    if (emailLower.includes('assam')) return 'Assam';
    if (emailLower.includes('manipur')) return 'Manipur';
  }

  // 4. District mapping fallback
  if (user.district) {
    const st = getStateForDistrict(user.district);
    if (st) return st;
  }

  return null;
}
