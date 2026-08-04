use once_cell::sync::Lazy;
use parking_lot::Mutex;
use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};
use sysinfo::System;

const POWER_IMPACT_SMOOTHING: f32 = 0.35;

static SAMPLER: Lazy<Mutex<DevPerformanceSampler>> =
    Lazy::new(|| Mutex::new(DevPerformanceSampler::new()));

struct DevPerformanceSampler {
    system: System,
    power_impact_percent: Option<f32>,
}

impl DevPerformanceSampler {
    fn new() -> Self {
        let mut system = System::new();
        system.refresh_cpu_usage();
        system.refresh_memory();
        Self {
            system,
            power_impact_percent: None,
        }
    }

    fn sample(&mut self) -> Result<DevPerformanceSnapshot, String> {
        if !sysinfo::IS_SUPPORTED_SYSTEM {
            return Err("system performance metrics are unavailable on this platform".into());
        }

        self.system.refresh_cpu_usage();
        self.system.refresh_memory();

        let cpu_percent = self.system.global_cpu_usage().clamp(0.0, 100.0);
        let memory_used_bytes = self.system.used_memory();
        let memory_total_bytes = self.system.total_memory();
        if memory_total_bytes == 0 {
            return Err("system memory metrics are unavailable on this platform".into());
        }

        let power_impact_percent = smooth_power_impact(self.power_impact_percent, cpu_percent);
        self.power_impact_percent = Some(power_impact_percent);

        Ok(DevPerformanceSnapshot {
            cpu_percent,
            memory_used_bytes,
            memory_total_bytes,
            power_impact_percent,
            sampled_at_ms: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
        })
    }
}

fn smooth_power_impact(previous: Option<f32>, cpu_percent: f32) -> f32 {
    let current = cpu_percent.clamp(0.0, 100.0);
    previous
        .map(|value| value * (1.0 - POWER_IMPACT_SMOOTHING) + current * POWER_IMPACT_SMOOTHING)
        .unwrap_or(current)
        .clamp(0.0, 100.0)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DevPerformanceSnapshot {
    cpu_percent: f32,
    memory_used_bytes: u64,
    memory_total_bytes: u64,
    power_impact_percent: f32,
    sampled_at_ms: u64,
}

#[tauri::command]
pub(crate) fn dev_performance_snapshot() -> Result<DevPerformanceSnapshot, String> {
    SAMPLER.lock().sample()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn power_impact_starts_at_the_current_sample() {
        assert_eq!(smooth_power_impact(None, 42.0), 42.0);
    }

    #[test]
    fn power_impact_smooths_and_clamps_cpu_spikes() {
        assert_eq!(smooth_power_impact(Some(20.0), 60.0), 34.0);
        assert_eq!(smooth_power_impact(Some(100.0), 140.0), 100.0);
        assert_eq!(smooth_power_impact(Some(0.0), -20.0), 0.0);
    }
}
