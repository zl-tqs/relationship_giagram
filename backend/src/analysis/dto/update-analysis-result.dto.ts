import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsIn, IsObject, IsOptional, IsString, MaxLength, ValidateNested,
} from 'class-validator';
import { ConfirmCharacterDto } from './confirm-analysis.dto.js';

export class UpdateRelationDto {
  @IsString()
  @MaxLength(20)
  from: string;

  @IsString()
  @MaxLength(20)
  to: string;

  @IsString()
  @MaxLength(40)
  type: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsIn(['high', 'medium', 'low'])
  confidence?: 'high' | 'medium' | 'low';
}

export class UpdateAnalysisResultDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ConfirmCharacterDto)
  characters?: ConfirmCharacterDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => UpdateRelationDto)
  relations?: UpdateRelationDto[];

  @IsOptional()
  @IsObject()
  corrections?: Record<string, unknown>;
}
