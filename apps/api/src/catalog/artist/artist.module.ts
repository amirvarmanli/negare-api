import { Module } from '@nestjs/common';
import { ArtistController } from '@app/catalog/artist/artist.controller';
import { ArtistService } from '@app/catalog/artist/artist.service';
import { CatalogModule } from '@app/catalog/catalog.module';

@Module({
  imports: [CatalogModule],
  controllers: [ArtistController],
  providers: [ArtistService],
  exports: [ArtistService],
})
export class ArtistModule {}
