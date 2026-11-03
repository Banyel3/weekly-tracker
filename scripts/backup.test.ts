import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = join(__dirname, "backup.sh");
const DAY_S = 24 * 60 * 60;

/** A copy of the repo layout with a stub `docker` that prints a dump (or fails) instead of reaching a container. */
function sandbox({ env, dockerFails = false }: { env?: string; dockerFails?: boolean }) {
  const root = mkdtempSync(join(tmpdir(), "wt-backup-"));
  mkdirSync(join(root, "scripts"));
  mkdirSync(join(root, "bin"));
  copyFileSync(SCRIPT, join(root, "scripts", "backup.sh"));
  if (env !== undefined) writeFileSync(join(root, ".env"), env);
  const docker = dockerFails ? "#!/bin/sh\necho partial\nexit 3\n" : "#!/bin/sh\necho 'SELECT 1;'\n";
  writeFileSync(join(root, "bin", "docker"), docker);
  chmodSync(join(root, "bin", "docker"), 0o755);
  mkdirSync(join(root, "backups"));
  const old = join(root, "backups", "weekly-tracker-20200101-0300.sql.gz");
  writeFileSync(old, "");
  const tenDaysAgo = Date.now() / 1000 - 10 * DAY_S;
  utimesSync(old, tenDaysAgo, tenDaysAgo);
  const run = () =>
    spawnSync("bash", [join(root, "scripts", "backup.sh")], {
      env: { PATH: `${join(root, "bin")}:/usr/bin:/bin`, HOME: root, NODE_ENV: "test" },
      encoding: "utf8",
    });
  return { root, old, run };
}

const files = (root: string) => readdirSync(join(root, "backups")).sort();

describe("scripts/backup.sh", () => {
  it("writes a gzip through a .tmp file and prints its path", () => {
    const { root, run } = sandbox({ env: "BACKUP_KEEP_DAYS=30\n" });
    const res = run();
    expect(res.status).toBe(0);
    const written = res.stdout.trim();
    expect(written).toMatch(/^backups\/weekly-tracker-\d{8}-\d{4}\.sql\.gz$/);
    expect(execFileSync("gunzip", ["-c", join(root, written)], { encoding: "utf8" })).toBe("SELECT 1;\n");
    expect(files(root).some((f) => f.endsWith(".tmp"))).toBe(false);
  });

  it("leaves no partial file when the dump fails", () => {
    const { root, run } = sandbox({ env: "", dockerFails: true });
    expect(run().status).not.toBe(0);
    expect(files(root)).toEqual(["weekly-tracker-20200101-0300.sql.gz"]);
  });

  it("strips quotes and whitespace from BACKUP_KEEP_DAYS in .env", () => {
    const { old, run } = sandbox({ env: 'BACKUP_KEEP_DAYS=" 7 "\r\n' });
    expect(run().status).toBe(0);
    expect(existsSync(old)).toBe(false);
  });

  it("falls back to 30 days when BACKUP_KEEP_DAYS is not a number", () => {
    const { old, run } = sandbox({ env: "BACKUP_KEEP_DAYS=a week\n" });
    expect(run().status).toBe(0);
    expect(existsSync(old)).toBe(true);
  });
});
