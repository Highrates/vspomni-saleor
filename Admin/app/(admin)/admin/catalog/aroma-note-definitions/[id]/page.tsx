import { AromaNoteDefinitionFormClient } from '../AromaNoteDefinitionFormClient';

export default function AdminAromaNoteDefinitionEditPage({
  params,
}: {
  params: { id: string };
}) {
  return <AromaNoteDefinitionFormClient definitionId={params.id} />;
}
