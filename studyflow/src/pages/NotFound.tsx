import { EmptyState, LinkButton } from '../components/ui';

export default function NotFound() {
  return <EmptyState title="Pàgina no trobada" action={<LinkButton to="/">Torna a l’inici</LinkButton>} />;
}
