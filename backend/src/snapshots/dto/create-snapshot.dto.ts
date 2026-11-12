import { Type } from 'class-transformer';
import {
  IsArray, IsInt, IsObject, IsOptional, IsString, Length, MaxLength, ValidateNested,
} from 'class-validator';

export class SnapshotDataDto {
  @IsOptional()
  @IsInt()
  schemaVersion?: number;

  @IsArray()
  nodes: unknown[];

  @IsArray()
  edges: unknown[];
}

export class CreateSnapshotDto {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsInt()
  baseRevision: number;

  @IsObject()
  @ValidateNested()
  @Type(() => SnapshotDataDto)
  data: SnapshotDataDto;

  @IsOptional()
  @IsObject()
  viewport?: { x: number; y: number; zoom: number };

  @IsOptional()
  @IsString()
  @MaxLength(128)
  contentHash?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}
