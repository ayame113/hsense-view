import { html } from "../../../static/utils/domtag.ts";
export function meta(
  { title, description, fullPathUrl, twitterUser, fullPathImageUrl }: {
    title: string;
    description: string;
    fullPathUrl: string;
    fullPathImageUrl: string;
    twitterUser: `@${string}`;
  },
) {
  return html`
    <meta charset="utf-8">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width">
		<title>${title}</title>
    <meta name="description" content="${description}"/>
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="${twitterUser}" />
    <meta property="og:url" content="${fullPathUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${fullPathImageUrl}" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
  `;
}
