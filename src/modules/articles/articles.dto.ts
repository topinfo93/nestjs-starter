import { PartialType } from '@nestjs/swagger';
import {
    IsBoolean,
    IsIn,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator';

export class ArticleInput {
    @IsString()
    @IsNotEmpty()
    @MaxLength(180)
    title!: string;

    @IsOptional()
    @IsString()
    @MaxLength(180)
    slug?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    excerpt?: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(50000)
    content!: string;

    @IsOptional()
    @IsIn(['DRAFT', 'PUBLISHED', 'HIDDEN'])
    status?: 'DRAFT' | 'PUBLISHED' | 'HIDDEN';

    @IsOptional()
    @IsBoolean()
    isSample?: boolean;
}

export class ArticleUpdateInput extends PartialType(ArticleInput) {}
