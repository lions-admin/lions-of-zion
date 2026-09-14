import 'server-only';
import { db } from '@/server/db/client';
import { featuredSlotsService } from './service';

export const featuredSlots = () => featuredSlotsService(db());
export { featuredSlotsService } from './service';
export type { FeaturedSlotName, FeaturedSlotState, FeaturedSlotChange } from '@/server/contracts/featured-slots';
export { FEATURED_SLOTS } from '@/server/contracts/featured-slots';
