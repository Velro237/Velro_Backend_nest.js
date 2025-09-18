import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}

// 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



// docker build -f Dockerfile.dev -t ghcr.io/cho237/velro_back_image .

// ghcr.io/cho237/velro_back_image

// docker push ghcr.io/cho237/velro_back_image 
