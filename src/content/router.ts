import { onSpaLocationChange } from "../core/dom/spa";
import { mountWeeklyOverlay } from "../features/weekly-overlay";
import { mountMonthlyHierarchy } from "../features/monthly-hierarchy";
import { mountCreateTaskEnhancer } from "../features/create-task-enhancer";
import { mountAutoparentCreate } from "../features/autoparent-create";

type RouteRule = {
  name: string;
  when: (pathname: string) => boolean;
  mount: () => Promise<void>;
};

const rules: RouteRule[] = [
  {
    name: "weekly-overlay",
    when: () => true,
    mount: mountWeeklyOverlay
  },
  {
    name: "monthly-hierarchy",
    when: () => true,
    mount: mountMonthlyHierarchy
  },
  {
    name: "create-task-enhancer",
    when: (pathname) => /\/_workitems\/(create\/task|edit\/\d+)/i.test(pathname),
    mount: mountCreateTaskEnhancer
  },
  {
    name: "autoparent-create",
    when: (pathname) => /\/_workitems\/create\//i.test(pathname),
    mount: mountAutoparentCreate
  }
];

const mounted = new Set<string>();

async function evaluateRoutes(): Promise<void> {
  const pathname = location.pathname;
  for (const rule of rules) {
    if (!rule.when(pathname) || mounted.has(rule.name)) continue;
    try {
      await rule.mount();
      mounted.add(rule.name);
    } catch (error) {
      console.error("[chrome-ado-hours] erro ao montar feature", rule.name, error);
    }
  }
}

export function bootRouter(): () => void {
  void evaluateRoutes();
  return onSpaLocationChange(() => {
    void evaluateRoutes();
  });
}
