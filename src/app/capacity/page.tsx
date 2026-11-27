import { Suspense } from 'react';
import { CapacityPlannerWorkspace } from '../../ui/capacity/CapacityPlannerWorkspace';
export const metadata = { title: 'Capacity planner · Azusa' };
export const dynamic = 'force-dynamic';
export default function Page() {
  return (
    <Suspense fallback={<h1>Capacity planner</h1>}>
      <CapacityPlannerWorkspace />
    </Suspense>
  );
}
