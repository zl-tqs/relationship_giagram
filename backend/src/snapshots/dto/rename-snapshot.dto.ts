import { IsString, Length } from 'class-validator';

export class RenameSnapshotDto {
  @IsString()
  @Length(1, 100)
  name: string;
}
