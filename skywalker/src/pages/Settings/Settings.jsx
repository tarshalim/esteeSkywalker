import { useState } from "react";
import { Link } from "react-router-dom";
import { Database, HardDrive, RefreshCw } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import { errorMessage } from "../../lib/errors";
import { FREE_TIER, fetchStorageUsage, formatBytes, quota } from "../../lib/storageUsage";
import LoadingSpinner from "../../components/LoadingSpinner/LoadingSpinner";

const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: "medium" });
const CARD = "rounded-2xl border-2 p-5";
const CARD_STYLE = { borderColor: "var(--border)", background: "var(--bg-elevated)" };

/** Bar colour by fill: blue, amber past 75%, red past 90%. */
function meterColor(pct) {
  if (pct >= 90) return "#dc2626";
  if (pct >= 75) return "#d97706";
  return "var(--blue)";
}

function Meter({ pct, label }) {
  const shown = Math.min(100, pct);
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full"
      style={{ background: "var(--border)" }}
      role="progressbar"
      aria-valuenow={Math.round(shown)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${shown}%`, background: meterColor(pct) }} />
    </div>
  );
}

function QuotaCard({ icon: Icon, title, used, limit, detail }) {
  const q = quota(used, limit);
  const over = q.remaining < 0;
  return (
    <section className={CARD} style={CARD_STYLE} aria-label={`${title} quota`}>
      <div className="mb-3 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
        <Icon size={16} aria-hidden="true" />
        <h2 className="text-sm font-semibold tracking-wide uppercase">{title}</h2>
      </div>
      <p className="text-2xl font-black" style={{ color: "var(--text-strong, var(--text))" }}>
        {formatBytes(q.used)}
        <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
          {" "}
          of {formatBytes(limit)}
        </span>
      </p>
      <div className="my-3">
        <Meter pct={q.pct} label={`${title} used`} />
      </div>
      <p className="flex justify-between gap-2 text-xs" style={{ color: over ? "#dc2626" : "var(--text-muted)" }}>
        <span className="font-semibold">
          {over ? `${formatBytes(-q.remaining)} over the free tier` : `${formatBytes(q.remaining)} free`}
        </span>
        <span>{q.pct < 0.1 && q.used > 0 ? "<0.1" : q.pct.toFixed(1)}% used</span>
      </p>
      {detail && (
        <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
          {detail}
        </p>
      )}
    </section>
  );
}

function BucketList({ buckets, total }) {
  if (buckets.length === 0) return null;
  return (
    <section className={CARD} style={CARD_STYLE}>
      <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase" style={{ color: "var(--text-muted)" }}>
        By bucket
      </h2>
      <ul className="flex flex-col gap-3">
        {buckets.map((b) => (
          <li key={b.bucket}>
            <div className="mb-1 flex justify-between gap-3 text-sm">
              <span className="font-mono" style={{ color: "var(--text)" }}>
                {b.bucket}
              </span>
              <span style={{ color: "var(--text-muted)" }}>
                {b.files} {b.files === 1 ? "file" : "files"} · <strong style={{ color: "var(--text)" }}>{formatBytes(b.bytes)}</strong>
              </span>
            </div>
            <Meter pct={total > 0 ? (b.bytes / total) * 100 : 0} label={`${b.bucket} share of file storage`} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function BlogBreakdown({ usage }) {
  const { blogs, storageBytes, storageFiles, blogMediaBytes, blogMediaFiles } = usage;
  const largest = Math.max(1, ...blogs.map((b) => b.totalBytes));
  const unlinkedBytes = Math.max(0, storageBytes - blogMediaBytes);
  const unlinkedFiles = Math.max(0, storageFiles - blogMediaFiles);

  return (
    <section className={CARD} style={CARD_STYLE}>
      <h2 className="text-sm font-semibold tracking-wide uppercase" style={{ color: "var(--text-muted)" }}>
        By blog post
      </h2>
      <p className="mt-1 mb-4 text-xs" style={{ color: "var(--text-muted)" }}>
        Media is every uploaded file a post references; text is the post&apos;s saved content in the database. A file used
        by several posts counts toward each of them.
      </p>

      {blogs.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          No blog posts yet.
        </p>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: "var(--text-muted)" }}>
                <th scope="col" className="px-2 pb-2 font-semibold">Post</th>
                <th scope="col" className="px-2 pb-2 text-right font-semibold">Files</th>
                <th scope="col" className="px-2 pb-2 text-right font-semibold">Media</th>
                <th scope="col" className="px-2 pb-2 text-right font-semibold">Text</th>
                <th scope="col" className="px-2 pb-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {blogs.map((b) => (
                <tr key={b.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="max-w-0 px-2 py-2.5">
                    <div className="flex items-center gap-2">
                      <Link
                        to={b.status === "published" ? `/blogs/${b.id}` : `/blogs/edit/${b.id}`}
                        className="truncate font-medium hover:underline"
                        style={{ color: "var(--text)" }}
                      >
                        {b.title}
                      </Link>
                      {b.status !== "published" && (
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                          style={{ background: "var(--bg-panel)", color: "var(--text-muted)" }}
                        >
                          {b.status || "draft"}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ background: "var(--border)" }} aria-hidden="true">
                      <div className="h-full rounded-full" style={{ width: `${(b.totalBytes / largest) * 100}%`, background: "var(--blue)" }} />
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: "var(--text-muted)" }}>{b.files}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: "var(--text-muted)" }}>{formatBytes(b.mediaBytes)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: "var(--text-muted)" }}>{formatBytes(b.rowBytes)}</td>
                  <td className="px-2 py-2.5 text-right font-semibold tabular-nums" style={{ color: "var(--text)" }}>{formatBytes(b.totalBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {unlinkedFiles > 0 && (
        <p className="mt-4 rounded-xl px-3 py-2 text-xs" style={{ background: "var(--bg-panel)", color: "var(--text-muted)" }}>
          <strong style={{ color: "var(--text)" }}>{formatBytes(unlinkedBytes)}</strong> in {unlinkedFiles}{" "}
          {unlinkedFiles === 1 ? "file isn't" : "files aren't"} used by any post: gallery photos, trip covers, templates, or
          leftovers from removed content.
        </p>
      )}
    </section>
  );
}

/** Admin-only Settings tab: storage quota and per-post usage, computed live each time it opens. */
export default function Settings() {
  const { data: usage, loading, error, setData } = useAsync(fetchStorageUsage, []);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);

  // Not useAsync's reload(): that one swallows errors to keep stale data on
  // screen. Here the admin asked explicitly, so show whether it worked.
  const refresh = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      setData(await fetchStorageUsage());
    } catch (err) {
      setRefreshError(errorMessage(err));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div
      className="min-h-dvh px-4 pt-[calc(var(--nav-bottom)+3rem)] pb-16 sm:pt-[calc(var(--nav-bottom)+4.5rem)]"
      style={{ background: "var(--bg)" }}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl" style={{ color: "var(--text-strong, var(--text))" }}>
              Settings
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {usage?.computedAt
                ? `Storage measured live at ${timeFormat.format(new Date(usage.computedAt))}`
                : "Storage is measured live each time this page opens."}
            </p>
          </div>
          {usage && (
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold disabled:opacity-60"
              style={{ background: "var(--bg-panel)", color: "var(--text)" }}
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : undefined} aria-hidden="true" />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          )}
        </header>

        {refreshError && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            Couldn&apos;t refresh: {refreshError}
          </p>
        )}

        {loading ? (
          <LoadingSpinner label="Measuring storage…" />
        ) : error ? (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            Couldn&apos;t load storage usage: {errorMessage(error)}
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <QuotaCard
                icon={HardDrive}
                title="File storage"
                used={usage.storageBytes}
                limit={FREE_TIER.storageBytes}
                detail={`${usage.storageFiles} ${usage.storageFiles === 1 ? "file" : "files"} across ${usage.buckets.length} ${usage.buckets.length === 1 ? "bucket" : "buckets"}`}
              />
              <QuotaCard
                icon={Database}
                title="Database"
                used={usage.databaseBytes}
                limit={FREE_TIER.databaseBytes}
                detail="Includes Postgres system tables and indexes, as Supabase counts it."
              />
            </div>
            <BlogBreakdown usage={usage} />
            <BucketList buckets={usage.buckets} total={usage.storageBytes} />
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Limits are the Supabase Free plan quotas. Nothing here is saved; every number is recomputed from storage
              and the database when you open or refresh this page.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
