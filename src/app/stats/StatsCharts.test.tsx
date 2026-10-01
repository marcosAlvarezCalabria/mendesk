import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Money } from "@/domain/values/Money";

import { MoneyChart } from "./StatsCharts";

describe("MoneyChart", () => {
  it("renders cartesian euro and time axes with every exact bucket amount", () => {
    const html = renderToStaticMarkup(
      <MoneyChart
        ariaLabel="Money received over time"
        bucket="day"
        buckets={[
          { key: "2026-09-21", amount: Money.fromEuros(50) },
          { key: "2026-09-22", amount: Money.fromEuros(12.5) },
        ]}
        emptyLabel="No payments"
        locale="en"
      />,
    );

    expect(html).toContain('data-axis="y"');
    expect(html).toContain('aria-label="Money received over time. 21 Sept €50.00, 22 Sept €12.50"');
    expect(html).toContain('data-axis="x"');
    expect(html).toContain("€50.00");
    expect(html).toContain("€25.00");
    expect(html).toContain("€0.00");
    expect(html).toContain("21 Sept");
    expect(html).toContain("22 Sept");
    expect(html).toContain("€12.50");
  });

  it("keeps the explicit empty-period message", () => {
    const html = renderToStaticMarkup(
      <MoneyChart ariaLabel="Money received over time" bucket="day" buckets={[]} emptyLabel="No payments" locale="en" />,
    );

    expect(html).toContain('aria-label="No payments"');
    expect(html).toContain("No payments");
  });
});
