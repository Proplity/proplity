# Fonts for the server-made PDFs

`LiberationSerif-Regular.ttf`, `-Bold.ttf` and `-Italic.ttf` are Liberation Serif 2.x (Times-compatible
metrics), licensed under the SIL Open Font License 1.1 (https://openfontlicense.org). They are
embedded in the agreement PDFs so the naira sign (₦) and curly quotes print correctly, which the
standard PDF fonts cannot do. Read at run time by `lib/pdf/agreementPdf.ts`; the route that makes
the PDF lists this folder in `outputFileTracingIncludes` (next.config.mjs) so deployments ship it.
