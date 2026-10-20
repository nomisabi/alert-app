// Plain HTML email templates (decided in milestone 4 because of the time; React Email is in the TODO).
// Email apps support little CSS, so styles are inline and the layout is a simple centered column.

/** Makes a value safe to put into HTML (a name like "<b>Ann</b>" is shown as text, not as markup). */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** A paragraph of already escaped HTML. */
export function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#1f2937;">${html}</p>`;
}

/** The frame around every email: app name on top, content, footer. `content` must be escaped. */
export function emailLayout({
  language,
  appName,
  title,
  content,
  footer,
}: {
  language: string;
  appName: string;
  title: string;
  content: string;
  footer: string;
}): string {
  return `<!doctype html>
<html lang="${escapeHtml(language)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:24px 16px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px 24px;">
      <p style="margin:0 0 24px;font-size:20px;font-weight:bold;color:#1565c0;">${escapeHtml(appName)}</p>
      ${content}
    </div>
    <p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:18px;color:#4b5563;text-align:center;">
      ${escapeHtml(footer)}
    </p>
  </body>
</html>`;
}
