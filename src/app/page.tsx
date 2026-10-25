import { LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function Home() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Capture</h1>
        <p className="mt-3 max-w-2xl text-white/70">The EMT tap-to-profile flow lands in the next pull request. Register a sticker and manage inventory in the meantime.</p>
      </div>
      <Card title="Get started">
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/register" variant="primary" icon="tag">
            Register a sticker
          </LinkButton>
          <LinkButton href="/inventory" icon="box">
            Manage inventory
          </LinkButton>
        </div>
      </Card>
    </div>
  );
}
