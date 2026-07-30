import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

// Flip7 global defaults — grid-free, teal/coral accent palette, cream tooltips
Chart.defaults.color = '#5C7A78';
Chart.defaults.borderColor = 'rgba(20, 48, 46, 0.08)';
Chart.defaults.font.family = "'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
Chart.defaults.plugins.legend.display = false;
Chart.defaults.plugins.tooltip.backgroundColor = '#F0F9F8';
Chart.defaults.plugins.tooltip.titleColor = '#14302E';
Chart.defaults.plugins.tooltip.bodyColor = '#5C7A78';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(43, 168, 162, 0.2)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.tooltip.cornerRadius = 12;
Chart.defaults.plugins.tooltip.displayColors = false;
Chart.defaults.plugins.tooltip.titleFont = { weight: 700 };
Chart.defaults.plugins.tooltip.bodyFont = { weight: 600 };
Chart.defaults.animation = { duration: 1200, easing: 'easeOutQuart' as const };
