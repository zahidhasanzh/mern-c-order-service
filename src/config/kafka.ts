import { Consumer, EachMessagePayload, Kafka } from "kafkajs";
import { MessageBroker } from "../types/broker";
import { handleToppingUpdate } from "../toppingCache/toppingUpdateHandler";
import { handleProdcutUpdate } from "../productCache/productUpdateHandler";

export class KafkaBroker implements MessageBroker {
  private consumer: Consumer;

  constructor(clientId: string, brokers: string[]) {
    const kafka = new Kafka({ clientId, brokers });

    this.consumer = kafka.consumer({ groupId: clientId });
  }

  /**
   * Connect the consumer
   */

  async connectConsumer() {
    await this.consumer.connect();
  }
  /**
   * discount the consumer
   */
  async disconnectConsumer() {
    await this.consumer.disconnect();
  }

  async consumeMessage(topics: string[], fromBeginning: boolean = false) {
    await this.consumer.subscribe({ topics, fromBeginning });

    await this.consumer.run({
      eachMessage: async ({
        topic,
        partition,
        message,
      }: EachMessagePayload) => {

        console.log({
          value: message.value.toString(),
          topic,
          partition,
        });

        switch (topic) {
          case "product":
            await handleProdcutUpdate(message.value.toString());
            return;
          case "topping":
            await handleToppingUpdate(message.value.toString());
            return;
          default:
            console.log("Doing nothing...");
        }

        console.log({
          value: message.value.toString(),
          topic,
          partition,
        });
      },
    });
  }
}
