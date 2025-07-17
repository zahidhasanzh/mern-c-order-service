import { Consumer, EachMessagePayload, Kafka, Producer } from "kafkajs";
import { MessageBroker } from "../types/broker";
import { handleToppingUpdate } from "../toppingCache/toppingUpdateHandler";
import { handleProdcutUpdate } from "../productCache/productUpdateHandler";

export class KafkaBroker implements MessageBroker {
  private consumer: Consumer;
  private producer: Producer;

  constructor(clientId: string, brokers: string[]) {
    const kafka = new Kafka({ clientId, brokers });

    this.producer = kafka.producer();
    this.consumer = kafka.consumer({ groupId: clientId });
  }

  /**
   * Connect the consumer
   */

  async connectConsumer() {
    await this.consumer.connect();
  }

   /**
   * Connect the producer
   */
  async connectProducer() {
    await this.producer.connect();
  }

  /**
   * discount the consumer
   */
  async disconnectConsumer() {
    await this.consumer.disconnect();
  }

   /**
   * Disconnect the producer
   */
  async disconnectProducer() {
    if (this.producer) {
      await this.producer.disconnect();
    }
  }

  /**
     *
     * @param topic - the topic to send the message to
     * @param message - the message to send
     * @throws {Error} - when the producer is not connected
     */
    async sendMessage(topic: string, message: string) {
        await this.producer.send({
            topic,
            messages: [{ value: message }],
        });
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
