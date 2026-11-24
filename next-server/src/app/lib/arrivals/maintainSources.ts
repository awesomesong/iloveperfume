import { RESOLVE_BATCH_SIZE, RETAILERS } from "./config";
import { discoverBrandLeads } from "./discoverBrands";
import { probeSource } from "./probeSource";
import { resolveBrandSites } from "./resolveBrandSites";
import { isPast } from "./siteData";
import {
  applyProbeVerdict,
  applyResolveResult,
  countDueProbes,
  countPendingLeads,
  deferIfCovered,
  loadDueProbes,
  loadMemberBrandLeads,
  loadPendingLeads,
  saveLeads,
} from "./sourceStore";

/**
 * 수집 대상 자동 관리 — 사람이 브랜드를 추가하지 않아도 수집 대상이 늘고, 사이트가 바뀌면 스스로 켜지고 꺼진다.
 *   discover: 판매처·회원 등록에서 브랜드 후보를 모은다
 *   resolve : 후보 브랜드의 공식 사이트를 웹 검색으로 찾아 등록한다 (판정 대기)
 *   probe   : 등록된 사이트를 읽을 수 있는지 판정해 켜거나 끈다
 * 크론은 수집을 마친 뒤 남는 시간에 한 단계만 한다(뒤 단계부터 — 판정할 것이 있으면 판정, 없으면 찾기).
 * 처음 채울 때나 한꺼번에 돌릴 때는 단계를 지정해 따로 실행한다(?maintain=discover|resolve|probe).
 */

export type MaintenanceStep = "discover" | "resolve" | "probe";

export type MaintenanceOptions = {
  /** 이 시각(ms)을 넘기지 않는다 */
  deadline: number;
  /** 지정하면 그 단계만, 없으면 할 일이 있는 단계를 고른다 */
  step?: MaintenanceStep;
  /** discover: 읽을 판매처 상품 페이지 수, resolve: 브랜드 수, probe: 사이트 수 */
  limit?: number;
  now?: Date;
};

export type MaintenanceResult = { step: MaintenanceStep; summary: Record<string, unknown> };

/** 웹 검색 1회에 걸리는 시간을 감안해, 남은 시간이 이보다 적으면 공식 사이트 찾기를 시작하지 않는다 */
const RESOLVE_MIN_TIME_MS = 15_000;
const PROBE_BATCH = 50;

async function runDiscover({ deadline, limit, now }: MaintenanceOptions) {
  const retailers: Record<string, unknown>[] = [];
  for (const retailer of RETAILERS) {
    try {
      const { leads, totalUrls, pagesRead } = await discoverBrandLeads(retailer, { maxPages: limit, now, deadline });
      retailers.push({ retailer: retailer.name, totalUrls, pagesRead, brands: leads.length, newLeads: await saveLeads(leads) });
    } catch (e) {
      // 판매처 하나를 못 읽어도 나머지 판매처와 회원 등록 브랜드는 진행한다
      retailers.push({ retailer: retailer.name, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { retailers, newMemberLeads: await saveLeads(await loadMemberBrandLeads()) };
}

async function runResolve({ deadline, limit, now = new Date() }: MaintenanceOptions) {
  let resolved = 0;
  let unresolved = 0;
  for (let done = 0; done < (limit ?? RESOLVE_BATCH_SIZE); done += RESOLVE_BATCH_SIZE) {
    if (deadline - Date.now() < RESOLVE_MIN_TIME_MS) break;
    const leads = await loadPendingLeads(Math.min(RESOLVE_BATCH_SIZE, (limit ?? RESOLVE_BATCH_SIZE) - done));
    if (leads.length === 0) break;
    const result = await resolveBrandSites(leads, deadline - Date.now());
    await applyResolveResult(result, now);
    resolved += result.resolved.length;
    unresolved += result.unresolved.length;
  }
  return { resolved, unresolved, pending: await countPendingLeads() };
}

async function runProbe({ deadline, limit = PROBE_BATCH, now = new Date() }: MaintenanceOptions) {
  const verdicts: Record<string, unknown>[] = [];
  for (const target of await loadDueProbes(now, limit)) {
    if (isPast(deadline)) break;
    if (await deferIfCovered(target, now)) continue;
    const verdict = await probeSource(target.host, deadline);
    const status = await applyProbeVerdict(target, verdict, now);
    verdicts.push({ brand: target.brand, host: target.host, status, outcome: verdict.outcome, reason: verdict.reason });
  }
  return { probed: verdicts.length, activated: verdicts.filter((v) => v.status === "ACTIVE").length, verdicts, due: await countDueProbes(now) };
}

export async function maintainSources(options: MaintenanceOptions): Promise<MaintenanceResult> {
  const now = options.now ?? new Date();
  const step: MaintenanceStep =
    options.step ?? ((await countDueProbes(now)) > 0 ? "probe" : (await countPendingLeads()) > 0 ? "resolve" : "discover");
  const run = { discover: runDiscover, resolve: runResolve, probe: runProbe }[step];
  return { step, summary: await run({ ...options, now }) };
}
