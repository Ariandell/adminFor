import ResourceManagerPage, { resourceConfigs } from './ResourceManagerPage';
import AchievementsPage from './AchievementsPage';
import SubscriptionsPage from './SubscriptionsPage';

export { AchievementsPage, SubscriptionsPage };
export function CosmeticsPage() { return <ResourceManagerPage config={resourceConfigs.cosmetics} />; }
export function PromoCodesPage() { return <ResourceManagerPage config={resourceConfigs.promos} />; }
export function SourcesPage() { return <ResourceManagerPage config={resourceConfigs.sources} />; }
