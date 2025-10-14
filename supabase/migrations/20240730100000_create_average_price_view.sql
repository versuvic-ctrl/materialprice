CREATE OR REPLACE VIEW average_daily_prices AS
SELECT
    material_id,
    category_id,
    date,
    AVG(price) AS average_price
FROM
    materials_prices
GROUP BY
    material_id,
    category_id,
    date;