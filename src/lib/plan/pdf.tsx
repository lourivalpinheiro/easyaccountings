import "server-only";
import {
  Circle,
  Document,
  Font,
  Image,
  Line,
  Link,
  Page,
  Path,
  Rect,
  renderToBuffer,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { layoutChart, LIGHT_THEME, type Prim } from "@/lib/charts/layout";
import { blockModel, type BlockModel, type Tone } from "@/lib/plan/blocks";
import { chartData, DEFAULT_CHART } from "@/lib/plan/calc";
import { PLAN_SECTION_LABELS, PLAN_SECTIONS, type BlockKind, type ChartSpec, type DocNode, type PlanSection, type PlanSnapshot } from "@/lib/plan/types";
import type { FlowType } from "@/lib/cash-flow-types";

// Sem hifenização automática (quebrava palavras como "en-tradas").
Font.registerHyphenationCallback((word) => [word]);

/** A4 em pontos, com margens de 48pt. */
const PAGE_W = 595.28;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const PRIMARY = "#1d4ed8";

const s = StyleSheet.create({
  page: { paddingTop: MARGIN, paddingBottom: 64, paddingHorizontal: MARGIN, fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.45, color: "#111827" },
  footer: { position: "absolute", bottom: 28, left: MARGIN, right: MARGIN, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#6b7280" },
  p: { marginBottom: 6 },
  h1: { fontFamily: "Helvetica-Bold", fontSize: 16, lineHeight: 1.3, marginTop: 10, marginBottom: 6 },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 13, lineHeight: 1.3, marginTop: 10, marginBottom: 5, color: PRIMARY },
  h3: { fontFamily: "Helvetica-Bold", fontSize: 11.5, lineHeight: 1.3, marginTop: 8, marginBottom: 4 },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 22, lineHeight: 1.25, color: PRIMARY },
  sectionDesc: { fontSize: 10, color: "#6b7280", marginTop: 2, marginBottom: 10 },
  rule: { borderBottomWidth: 1, borderBottomColor: "#d1d5db", marginVertical: 8 },
  quote: { borderLeftWidth: 3, borderLeftColor: "#d1d5db", paddingLeft: 8, marginBottom: 6, color: "#4b5563" },
  code: { fontFamily: "Courier", fontSize: 8.5, backgroundColor: "#f3f4f6", padding: 6, marginBottom: 6 },
  box: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 4, padding: 8, marginVertical: 6 },
  blockTitle: { fontFamily: "Helvetica-Bold", fontSize: 10.5, marginBottom: 6 },
  muted: { color: "#6b7280" },
});

const TONE: Record<NonNullable<Tone>, string> = { positive: "#15803d", negative: "#b91c1c", warning: "#b45309", muted: "#6b7280" };

export type PdfImages = Map<string, { data: Buffer; format: "png" | "jpg" } | null>;

type Ctx = { snap: PlanSnapshot; images: PdfImages; siteUrl: string };

// ---------- Texto ----------

type Mark = { type: string; attrs?: Record<string, unknown> };

function fontFor(marks: Mark[]) {
  const bold = marks.some((m) => m.type === "bold");
  const italic = marks.some((m) => m.type === "italic");
  const code = marks.some((m) => m.type === "code");
  const family = String(marks.find((m) => m.type === "textStyle")?.attrs?.fontFamily ?? "");
  const base = code || /courier|mono/i.test(family) ? "Courier" : /times|georgia|serif/i.test(family) && !/sans/i.test(family) ? "Times" : "Helvetica";
  if (base === "Times") return bold && italic ? "Times-BoldItalic" : bold ? "Times-Bold" : italic ? "Times-Italic" : "Times-Roman";
  const suffix = bold && italic ? "-BoldOblique" : bold ? "-Bold" : italic ? "-Oblique" : "";
  return `${base}${suffix}`;
}

function markStyle(marks: Mark[]): Style {
  const style: Style = { fontFamily: fontFor(marks) };
  const ts = marks.find((m) => m.type === "textStyle")?.attrs;
  if (ts?.color) style.color = String(ts.color);
  const size = String(ts?.fontSize ?? "").match(/^(\d+)px$/);
  if (size) style.fontSize = Number(size[1]) * 0.75;
  const hl = marks.find((m) => m.type === "highlight")?.attrs;
  if (marks.some((m) => m.type === "highlight")) style.backgroundColor = String(hl?.color ?? "#fef08a");
  const deco = [marks.some((m) => m.type === "underline") && "underline", marks.some((m) => m.type === "strike") && "line-through"].filter(Boolean);
  if (deco.length) style.textDecoration = deco.join(" ") as Style["textDecoration"];
  if (marks.some((m) => m.type === "subscript" || m.type === "superscript")) style.fontSize = 7;
  return style;
}

function absoluteUrl(href: string, siteUrl: string) {
  if (/^(https?:|mailto:)/i.test(href)) return href;
  if (href.startsWith("/")) return `${siteUrl.replace(/\/$/, "")}${href}`;
  return null;
}

function inline(nodes: DocNode[] | undefined, ctx: Ctx): React.ReactNode[] {
  return (nodes ?? []).map((n, i) => {
    if (n.type === "hardBreak") return "\n";
    if (n.type !== "text") return null;
    const marks = (n.marks ?? []) as Mark[];
    const link = marks.find((m) => m.type === "link");
    const href = link ? absoluteUrl(String(link.attrs?.href ?? ""), ctx.siteUrl) : null;
    if (href) {
      return (
        <Link key={i} src={href} style={{ ...markStyle(marks), color: PRIMARY }}>
          {n.text}
        </Link>
      );
    }
    return (
      <Text key={i} style={markStyle(marks)}>
        {n.text}
      </Text>
    );
  });
}

const alignOf = (n: DocNode): Style["textAlign"] => {
  const a = n.attrs?.textAlign;
  return a === "center" || a === "right" || a === "justify" ? a : undefined;
};

// ---------- Gráficos ----------

function SvgPrim({ p }: { p: Prim }) {
  switch (p.k) {
    case "rect":
      return <Rect x={p.x} y={p.y} width={Math.max(0, p.w)} height={Math.max(0, p.h)} fill={p.fill} />;
    case "line":
      return <Line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.width} />;
    case "path":
      return <Path d={p.d} fill={p.fill} stroke={p.stroke === "none" ? undefined : p.stroke} strokeWidth={p.width} fillOpacity={p.opacity} />;
    case "circle":
      return <Circle cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} />;
    case "text":
      return (
        <Text x={p.x} y={p.y} textAnchor={p.anchor} fill={p.fill} style={{ fontSize: p.size, fontFamily: p.bold ? "Helvetica-Bold" : "Helvetica" }}>
          {p.text}
        </Text>
      );
  }
}

function ChartPdf({ spec, ctx }: { spec: ChartSpec; ctx: Ctx }) {
  const height = 230;
  const prims = layoutChart(chartData(spec, ctx.snap.dataset, ctx.snap), spec.chartType, CONTENT_W, height, LIGHT_THEME);
  return (
    <View wrap={false} style={{ marginVertical: 8 }}>
      {spec.title ? <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10, textAlign: "center", marginBottom: 4 }}>{spec.title}</Text> : null}
      <Svg width={CONTENT_W} height={height} viewBox={`0 0 ${CONTENT_W} ${height}`}>
        {prims.map((p, i) => (
          <SvgPrim key={i} p={p} />
        ))}
      </Svg>
    </View>
  );
}

// ---------- Blocos de dados ----------

function BlockPdf({ model }: { model: BlockModel }) {
  const cols = model.table?.columns ?? [];
  const weights = cols.map((c) => c.width ?? 1);
  const small = model.table?.small;
  return (
    <View style={s.box}>
      <Text style={s.blockTitle}>{model.title}</Text>
      {model.empty ? (
        <Text style={s.muted}>{model.empty}</Text>
      ) : (
        <>
          {model.cards && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 6 }}>
              {model.cards.map((c) => (
                <View key={c.label} wrap={false} style={{ width: "33.33%", padding: 3 }}>
                  <View style={{ backgroundColor: "#f9fafb", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 3, padding: 5 }}>
                    <Text style={{ fontSize: 7.5, color: "#6b7280" }}>{c.label}</Text>
                    <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10.5, color: c.tone ? TONE[c.tone] : undefined }}>{c.value}</Text>
                    {c.hint ? <Text style={{ fontSize: 7, color: "#6b7280" }}>{c.hint}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          )}
          {model.table && (
            <View>
              <View style={{ flexDirection: "row", borderBottomWidth: 1.5, borderBottomColor: "#374151" }} fixed={false}>
                {cols.map((c, i) => (
                  <Text
                    key={i}
                    style={{ flex: weights[i], fontFamily: "Helvetica-Bold", fontSize: small ? 6.5 : 8, padding: 2, textAlign: c.align ?? "left" }}
                  >
                    {c.label}
                  </Text>
                ))}
              </View>
              {model.table.rows.map((r, ri) => (
                <View
                  key={ri}
                  wrap={false}
                  style={{ flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb", backgroundColor: r.shaded ? "#f3f4f6" : undefined }}
                >
                  {r.cells.map((cell, ci) => (
                    <Text
                      key={ci}
                      style={{
                        flex: weights[ci],
                        fontSize: small ? 6.5 : 8.5,
                        padding: 2,
                        textAlign: cols[ci]?.align ?? "left",
                        fontFamily: r.bold || cell.bold ? "Helvetica-Bold" : "Helvetica",
                        color: cell.tone ? TONE[cell.tone] : undefined,
                      }}
                    >
                      {cell.text}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          )}
          {model.notes?.map((n, i) => (
            <Text key={i} style={{ fontSize: 8.5, marginTop: 3, color: n.tone ? TONE[n.tone] : undefined }}>
              {n.text}
            </Text>
          ))}
        </>
      )}
    </View>
  );
}

// ---------- Documento do editor ----------

function Nodes({ nodes, ctx, depth = 0 }: { nodes: DocNode[] | undefined; ctx: Ctx; depth?: number }) {
  return <>{(nodes ?? []).map((n, i) => <NodePdf key={i} node={n} ctx={ctx} depth={depth} />)}</>;
}

function NodePdf({ node: n, ctx, depth }: { node: DocNode; ctx: Ctx; depth: number }) {
  switch (n.type) {
    case "paragraph":
      if (!n.content?.length) return <View style={{ height: 6 }} />;
      return <Text style={{ ...s.p, textAlign: alignOf(n) }}>{inline(n.content, ctx)}</Text>;
    case "heading": {
      const level = Number(n.attrs?.level) || 2;
      return (
        <Text minPresenceAhead={70} style={{ ...(level === 1 ? s.h1 : level === 2 ? s.h2 : s.h3), textAlign: alignOf(n) }}>
          {inline(n.content, ctx)}
        </Text>
      );
    }
    case "bulletList":
    case "orderedList":
      return (
        <View style={{ marginBottom: 4, marginLeft: depth ? 12 : 0 }}>
          {(n.content ?? []).map((item, i) => (
            <View key={i} style={{ flexDirection: "row" }}>
              <Text style={{ width: 14 }}>{n.type === "orderedList" ? `${(Number(n.attrs?.start) || 1) + i}.` : "•"}</Text>
              <View style={{ flex: 1 }}>
                <Nodes nodes={item.content} ctx={ctx} depth={depth + 1} />
              </View>
            </View>
          ))}
        </View>
      );
    case "blockquote":
      return (
        <View style={s.quote}>
          <Nodes nodes={n.content} ctx={ctx} depth={depth} />
        </View>
      );
    case "codeBlock":
      return <Text style={s.code}>{(n.content ?? []).map((c) => c.text ?? "").join("")}</Text>;
    case "horizontalRule":
      return <View style={s.rule} />;
    case "image": {
      const src = String(n.attrs?.src ?? "");
      const img = ctx.images.get(src);
      if (!img) return <Text style={{ ...s.muted, ...s.p }}>[Imagem não disponível no PDF: {String(n.attrs?.alt ?? src)}]</Text>;
      // eslint-disable-next-line jsx-a11y/alt-text -- o Image do react-pdf não tem atributo alt.
      return <Image src={img} style={{ maxWidth: CONTENT_W, maxHeight: 420, objectFit: "contain", marginVertical: 6, alignSelf: "center" }} />;
    }
    case "table":
      return (
        <View style={{ borderWidth: 0.75, borderColor: "#9ca3af", marginVertical: 6 }}>
          {(n.content ?? []).map((row, ri) => (
            <View key={ri} wrap={false} style={{ flexDirection: "row", borderTopWidth: ri ? 0.75 : 0, borderTopColor: "#9ca3af" }}>
              {(row.content ?? []).map((cell, ci) => (
                <View
                  key={ci}
                  style={{
                    flex: Number(cell.attrs?.colspan) || 1,
                    padding: 3,
                    borderLeftWidth: ci ? 0.75 : 0,
                    borderLeftColor: "#9ca3af",
                    backgroundColor: cell.type === "tableHeader" ? "#f3f4f6" : undefined,
                  }}
                >
                  <Nodes nodes={cell.content} ctx={ctx} depth={depth} />
                </View>
              ))}
            </View>
          ))}
        </View>
      );
    case "planChart":
      return <ChartPdf spec={{ ...DEFAULT_CHART, ...(n.attrs?.spec as Partial<ChartSpec>) }} ctx={ctx} />;
    case "planBlock":
      return (
        <BlockPdf
          model={blockModel(
            n.attrs?.kind as BlockKind,
            { type: (n.attrs?.type as FlowType) ?? "saida", limit: Number(n.attrs?.limit) || 8 },
            ctx.snap.dataset,
            ctx.snap,
          )}
        />
      );
    default:
      return n.content ? <Nodes nodes={n.content} ctx={ctx} depth={depth} /> : null;
  }
}

// ---------- Documento ----------

export type PdfMeta = { companyName: string; companyDocument: string; generatedAt: string; versionLabel: string | null };

function PlanDocument({ ctx, meta, tocPages }: { ctx: Ctx; meta: PdfMeta; tocPages: Partial<Record<PlanSection, number>> }) {
  const { snap } = ctx;
  // O rodapé de cada seção também anota a primeira página dela, usada no sumário.
  const footer = (section?: PlanSection) => (
    <View style={s.footer} fixed>
      <Text>
        {snap.title}
        {meta.versionLabel ? ` · ${meta.versionLabel}` : ""}
      </Text>
      <Text
        render={({ pageNumber, totalPages }) => {
          if (section) tocPages[section] = Math.min(tocPages[section] ?? pageNumber, pageNumber);
          return `Página ${pageNumber} de ${totalPages}`;
        }}
      />
    </View>
  );
  return (
    <Document title={snap.title} author={meta.companyName} subject={`Planejamento financeiro ${snap.dataset.year}`} creator="Nedemy Finanças" language="pt-BR">
      <Page size="A4" style={{ ...s.page, justifyContent: "space-between" }}>
        <View style={{ height: 6, backgroundColor: PRIMARY, marginHorizontal: -MARGIN, marginTop: -MARGIN }} />
        <View>
          <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>Planejamento financeiro</Text>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 30, color: PRIMARY, lineHeight: 1.15 }}>{snap.title}</Text>
          <Text style={{ fontSize: 48, fontFamily: "Helvetica-Bold", color: "#d1d5db", marginTop: 10 }}>{snap.dataset.year}</Text>
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 10 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12 }}>{meta.companyName}</Text>
          {meta.companyDocument ? <Text style={s.muted}>{meta.companyDocument}</Text> : null}
          <Text style={{ ...s.muted, marginTop: 6 }}>Gerado em {meta.generatedAt}</Text>
          {meta.versionLabel ? <Text style={s.muted}>{meta.versionLabel}</Text> : null}
        </View>
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={s.sectionTitle}>Sumário</Text>
        <View style={{ marginTop: 16 }}>
          {PLAN_SECTIONS.map((sec, i) => (
            <View key={sec} style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 10 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12 }}>
                {i + 1}. {PLAN_SECTION_LABELS[sec].title}
              </Text>
              <View style={{ flex: 1, borderBottomWidth: 0.75, borderBottomColor: "#d1d5db", borderStyle: "dotted", marginHorizontal: 6, marginBottom: 3 }} />
              <Text style={{ fontSize: 12 }}>{tocPages[sec] ?? ""}</Text>
            </View>
          ))}
        </View>
        {footer()}
      </Page>

      {PLAN_SECTIONS.map((sec, i) => (
        <Page key={sec} size="A4" style={s.page} wrap>
          <Text style={s.sectionTitle}>{`${i + 1}. ${PLAN_SECTION_LABELS[sec].title}`}</Text>
          <Text style={s.sectionDesc}>{PLAN_SECTION_LABELS[sec].description}</Text>
          <View style={{ ...s.rule, marginTop: 0 }} />
          {snap.content[sec]?.content?.length ? (
            <Nodes nodes={snap.content[sec]!.content} ctx={ctx} />
          ) : (
            <Text style={s.muted}>Seção sem conteúdo.</Text>
          )}
          {footer(sec)}
        </Page>
      ))}
    </Document>
  );
}

/** Gera o PDF do plano. Faz duas passagens: a primeira descobre a página de cada seção para o sumário. */
export async function renderPlanPdf(snap: PlanSnapshot, meta: PdfMeta, images: PdfImages, siteUrl: string) {
  const ctx: Ctx = { snap, images, siteUrl };
  const pages: Partial<Record<PlanSection, number>> = {};
  await renderToBuffer(<PlanDocument ctx={ctx} meta={meta} tocPages={pages} />);
  return renderToBuffer(<PlanDocument ctx={ctx} meta={meta} tocPages={{ ...pages }} />);
}

/** Endereços de imagens usados nos textos do plano. */
export function collectImageSources(content: PlanSnapshot["content"]) {
  const out = new Set<string>();
  const walk = (n: DocNode) => {
    if (n.type === "image" && typeof n.attrs?.src === "string") out.add(n.attrs.src);
    n.content?.forEach(walk);
  };
  for (const sec of PLAN_SECTIONS) if (content[sec]) walk(content[sec]!);
  return [...out];
}
