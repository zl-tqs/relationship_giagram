import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const ONLINE_LOOKUP_MODES = ['auto', 'always', 'never'] as const;

export class OnlineLookupDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  author?: string;

  @IsIn(ONLINE_LOOKUP_MODES)
  mode: (typeof ONLINE_LOOKUP_MODES)[number];
}
