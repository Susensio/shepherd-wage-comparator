# Shepherd Wage Comparator

A single-page tool for shepherds in Spain to compare job offers. It checks each offer against the legal minimum wage, the night-stay bonus, holidays, weekly rest and the 40-hour week, and shows what is left unpaid, both on the payslip and in cash.

The interface is in Spanish. Everything lives in one file, `index.html`, with no dependencies or build step: open it in a browser.

Data stays in the browser (`localStorage`). When the page is hosted as a Claude artifact, it can also sync to the cloud.

The figures are estimates and are not legal advice.
