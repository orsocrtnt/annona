-- Migration des récurrences existantes vers intervalValue / intervalUnit
UPDATE recurring_orders SET interval_value = 1, interval_unit = 'WEEKS' WHERE frequency = 'WEEKLY';
UPDATE recurring_orders SET interval_value = 2, interval_unit = 'WEEKS' WHERE frequency = 'BIWEEKLY';
UPDATE recurring_orders SET interval_value = 1, interval_unit = 'MONTHS' WHERE frequency = 'MONTHLY';
UPDATE recurring_orders SET start_at = created_at WHERE start_at IS NULL;
