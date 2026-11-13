import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';

export class CharacterCandidateDto {
  @IsString()
  @MaxLength(20)
  name: string;

  @IsInt()
  @Min(0)
  count: number;

  @IsIn(['high', 'medium', 'low'])
  confidence: 'high' | 'medium' | 'low';
}

export class CooccurrenceDto {
  @IsString()
  @MaxLength(20)
  a: string;

  @IsString()
  @MaxLength(20)
  b: string;

  @IsInt()
  @Min(0)
  count: number;
}

export class SaveStructuredDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CharacterCandidateDto)
  candidates: CharacterCandidateDto[];

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CooccurrenceDto)
  cooccurrences: CooccurrenceDto[];

  @IsString()
  @MaxLength(200000)
  excerpt: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  chapterCount?: number;
}
