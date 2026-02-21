import { Configuration, Value } from '@itgorillaz/configify';

@Configuration()
export class HumanIdConfig {
  @Value('HUMAN_ID_PADDING_LENGTH', {
    default: 6,
    parse: (value) => Number(value),
  })
  paddingLength: number;
}
