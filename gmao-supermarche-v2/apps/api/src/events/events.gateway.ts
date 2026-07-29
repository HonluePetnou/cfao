import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
} from "@nestjs/websockets";
import { Server } from "socket.io";

@WebSocketGateway({ cors: { origin: "*" } })
export class EventsGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  afterInit() {
    console.log("WebSocket gateway initialized");
  }

  notifyMaintenancier(maintenancierId: string, event: string, data: any) {
    this.server?.to(`maintenancier:${maintenancierId}`).emit(event, data);
  }

  notifyAdmin(event: string, data: any) {
    this.server?.to("admin").emit(event, data);
  }
}
