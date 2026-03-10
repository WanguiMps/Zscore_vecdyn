export type Row = {
  species: string;
  sample_location: string;
  sample_end_date: string;
  sample_value: number;
  sample_lat_dd: number;
  sample_long_dd: number;
};

export type WeeklyPoint = {
  sampleLocation: string;
  lat: number;
  lng: number;
  minDate: string;
  maxDate: string;
  weekRange: string;
  totalSampleValue: number;
  weeklySampleValueZscore: number;
};

export type WeeklyAggregation = {
  sampleLocation: string;
  year: number;
  weekOfYear: number;
  totalSampleValue: number;
  minDate: Date;
  maxDate: Date;
};

export type TrendPoint = {
  date: string;
  mean: number;
  count: number;
};

export type Season = "Spring" | "Summer" | "Autumn" | "Winter";
