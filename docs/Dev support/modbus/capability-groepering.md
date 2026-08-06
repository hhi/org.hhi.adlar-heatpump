# Capability Groepering

Logische volgorde van capabilities in `driver.compose.json`. Gebruik deze volgorde als referentie bij het toevoegen van nieuwe capabilities.

| # | Groep | Capabilities |
|---|---|---|
| 1 | Bediening | `onoff`, `target_temperature`, `target_temperature.cooling`, `target_temperature.dhw`, `target_temperature.floor` |
| 2 | Temperatuursensoren | `measure_temperature.outlet`, `measure_temperature.inlet`, `measure_temperature.ambient`, `measure_temperature.outer_coil`, `measure_temperature.inner_coil`, `measure_temperature.suction`, `measure_temperature.exhaust`, `measure_temperature.dhw`, `measure_temperature.econ_in`, `measure_temperature.econ_out`, `measure_temperature.hp_sat`, `measure_temperature.lp_sat`, `measure_temperature.ipm`, `measure_temperature.plate_hx`, `measure_temperature.dhw_return`, `measure_temperature.buffer_tank`, `measure_temperature.total_outlet`, `measure_temperature.zone1_mix`, `measure_temperature.zone2` |
| 3 | Elektrisch | `measure_power`, `meter_power`, `measure_voltage`, `measure_current`, `measure_current.comp_phase`, `measure_current.b_phase`, `measure_current.c_phase` |
| 4 | Bedrijfsstatus | `adlar_running`, `adlar_compressor_on`, `adlar_mode`, `adlar_state_compressor_state`, `adlar_state_defrost_state`, `adlar_state_backwater`, `adlar_antifreeze`, `adlar_sterilization`, `adlar_hotwater` |
| 5 | Mechanisch | `adlar_compressor_freq`, `adlar_comp_target_freq`, `adlar_fan_speed`, `adlar_eev_step`, `adlar_evi_step`, `adlar_pump_pwm`, `adlar_water_flow` |
| 6 | Defrost | `adlar_defrosting`, `adlar_defrost_count_24h`, `adlar_defrost_minutes_24h`, `defrost_active_power` |
| 7 | Fouten | `alarm_generic`, `adlar_fault`, `adlar_fault_shutdown`, `adlar_fault_1`, `adlar_fault_2`, `adlar_fault_3`, `adlar_fault_active` |
| 8 | COP & SCOP | `adlar_cop`, `adlar_cop_method`, `adlar_cop_daily`, `adlar_cop_weekly`, `adlar_cop_monthly`, `adlar_cop_trend`, `adlar_scop`, `adlar_scop_quality` |
| 9 | Verwarmingscurve | `heating_curve_formula`, `heating_curve_slope`, `heating_curve_intercept`, `heating_curve_ref_outdoor`, `heating_curve_ref_temp` |
| 10 | Externe inputs | `measure_temperature.indoor`, `target_temperature.indoor`, `adlar_external_power`, `adlar_external_flow`, `adlar_external_ambient`, `adlar_external_solar_power`, `adlar_external_solar_radiation`, `adlar_external_wind_speed`, `adlar_external_indoor_temperature`, `adlar_last_indoor_temp_received`, `adlar_last_outdoor_temp_received`, `adlar_last_solar_power_received`, `adlar_last_solar_radiation_received`, `adlar_last_wind_received` |
| 11 | Energieprijzen | `adlar_energy_price_current`, `adlar_energy_price_next`, `adlar_energy_price_category`, `adlar_price_forecast_4h`, `adlar_price_forecast_24h`, `energy_prices_data`, `adlar_cheapest_block_start`, `adlar_price_savings_potential` |
| 12 | Energiekosten | `adlar_energy_cost_daily`, `adlar_energy_cost_hourly`, `adlar_external_energy_daily`, `adlar_external_energy_total` |
| 13 | Adaptieve regeling | `adlar_simulated_target`, `adaptive_control_diagnostics`, `cop_optimizer_diagnostics`, `adlar_optimal_delay` |
| 14 | Gebouwmodel | `adlar_building_ua`, `adlar_building_tau`, `adlar_building_g`, `adlar_building_c`, `adlar_building_pint`, `building_model_diagnostics`, `building_insight_insulation`, `building_insight_preheating`, `building_insight_profile`, `building_insight_thermal_storage`, `building_insights_diagnostics` |
| 15 | Prognose | `adlar_forecast_advice`, `adlar_forecast_cop_correction` |
| 16 | Prestaties | `adlar_performance_report`, `adlar_performance_score` |
| 17 | Verbinding & monitoring | `adlar_connection_status`, `adlar_connection_active`, `adlar_daily_disconnect_count`, `adlar_firmware_mcu`, `adlar_protocol_version`, `adlar_openmeteo_last_fetch` |
| 18 | Enums | `adlar_enum_countdown_set`, `adlar_enum_work_mode`, `adlar_enum_capacity_set` |
