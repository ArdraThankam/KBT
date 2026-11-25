-- Recommended indexes for kbt_form2_appln_verified (~675,000 rows).
-- Review and apply manually after verifying storage/maintenance windows.
-- Do NOT execute automatically in production without DBA approval.

-- 1. Core active/location/status filter & dashboard grouping pass
CREATE INDEX idx_kbt_del_dist_status
  ON kbt_form2_appln_verified (appln_delete, appln_dist, appln_taluk, appln_village, appln_status, appln_pointer);

-- 2. Solar & dwelling segmentation and cross-tab aggregations
CREATE INDEX idx_kbt_solar_flat
  ON kbt_form2_appln_verified (appln_delete, appln_solar, appln_flat_yesno);

-- 3. Fast deduplication (latest row per appln_appln_id via MAX(appln_id))
CREATE INDEX idx_kbt_appln_id_pk
  ON kbt_form2_appln_verified (appln_appln_id, appln_id);

-- 4. Year-wise aggregation & date range filtering
CREATE INDEX idx_kbt_form2_date
  ON kbt_form2_appln_verified (appln_delete, appln_form2_date);
