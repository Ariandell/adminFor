import ResourceManagerPage, { resourceConfigs } from './ResourceManagerPage';

export function AchievementsPage() { return <ResourceManagerPage config={resourceConfigs.achievements} />; }
export function CosmeticsPage() { return <ResourceManagerPage config={resourceConfigs.cosmetics} />; }
export function SubscriptionsPage() { return <ResourceManagerPage config={resourceConfigs.subscriptions} />; }
export function PromoCodesPage() { return <ResourceManagerPage config={resourceConfigs.promos} />; }
export function SourcesPage() { return <ResourceManagerPage config={resourceConfigs.sources} />; }
