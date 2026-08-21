import { Card, Icon } from '@jasindo/shared';

const MODULES = [
  { title: 'Host shell', port: '5000', body: 'Routing, layout, auth guard, error boundaries.', icon: 'dashboard' },
  { title: 'users_mfe', port: '5001', body: 'User CRUD, search, filter, pagination.', icon: 'group' },
  { title: 'auth_mfe', port: '5002', body: 'Login form and token handling.', icon: 'lock' },
];

export function AboutPage() {
  return (
    <section className="space-y-4">
      <h1 className="md-headline-small text-on-surface">About this application</h1>

      <Card variant="outlined" className="p-5">
        <p className="md-body-medium text-on-surface-variant">
          Coding test for PT. Asuransi Jasa Indonesia. React front end, Laravel API,
          PostgreSQL database, built as a microfrontend and styled with Material Design 3.
        </p>

        <div className="mt-5 grid gap-3 medium:grid-cols-3">
          {MODULES.map((m) => (
            <Card key={m.title} variant="filled" className="p-4">
              <Icon name={m.icon} size={24} className="text-primary" />
              <p className="md-title-small mt-2 text-on-surface">
                {m.title} <span className="text-on-surface-variant">:{m.port}</span>
              </p>
              <p className="md-body-small mt-1 text-on-surface-variant">{m.body}</p>
            </Card>
          ))}
        </div>

        <p className="md-body-small mt-5 text-on-surface-variant">
          Each module builds and deploys on its own. The host loads them at runtime over HTTP
          and never compiles their source.
        </p>
      </Card>
    </section>
  );
}

export default AboutPage;
