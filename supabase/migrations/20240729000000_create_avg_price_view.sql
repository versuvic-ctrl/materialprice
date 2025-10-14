CREATE OR REPLACE VIEW public.kpi_average_price AS
SELECT avg(price) AS average_price
FROM public.kpi_price_data;