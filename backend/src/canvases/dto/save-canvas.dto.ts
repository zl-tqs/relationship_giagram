import { IsArray, IsInt, IsObject } from 'class-validator';

export class SaveCanvasDto {
  @IsArray()
  nodes: unknown[];

  @IsArray()
  edges: unknown[];

  @IsObject()
  viewport: { x: number; y: number; zoom: number };

  @IsInt()
  baseVersion: number;
}
