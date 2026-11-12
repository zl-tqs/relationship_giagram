import { IsInt } from 'class-validator';

export class RestoreSnapshotDto {
  @IsInt()
  baseRevision: number;
}
