import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const MAX_NOVEL_FILE_SIZE = 10 * 1024 * 1024;
export const ANALYSIS_TEMPLATES = ['default', 'xuanhuan', 'wuxia', 'romance'] as const;

export class CreateAnalysisJobDto {
  @IsString()
  @MaxLength(255)
  fileName: string;

  @IsInt()
  @Min(1)
  @Max(MAX_NOVEL_FILE_SIZE)
  fileSize: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  charCount?: number;

  @IsOptional()
  @IsIn(ANALYSIS_TEMPLATES)
  template?: string;

  @IsOptional()
  @IsBoolean()
  keepResult?: boolean;
}
