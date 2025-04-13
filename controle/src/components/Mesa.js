import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";

export default function Mesa({ mesa, pedidos, onMove, onDrop, onVerPedidos }) {
  const temPedidosNovos = pedidos.some(
    (p) => p.status === "aguardando" && !p.entregue
  );
  const pan = useRef(new Animated.ValueXY()).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (temPedidosNovos) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0.4,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      fadeAnim.setValue(1);
    }
  }, [temPedidosNovos]);

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: pan.x, translationY: pan.y } }],
    { useNativeDriver: false }
  );

  const onHandlerStateChange = (event) => {
    if (event.nativeEvent.state === State.END) {
      onMove(mesa.id, pan.x._value, pan.y._value);
      pan.setValue({ x: 0, y: 0 });
      onDrop(mesa.id);
    }
  };

  const estadoMesa =
    mesa.status === "fechada"
      ? "fechada"
      : temPedidosNovos
      ? "ver pedidos"
      : "aberta";
  const buttonStyle = [
    styles.botao,
    estadoMesa === "fechada" && styles.botaoFechada,
    estadoMesa === "aberta" && styles.botaoAberta,
    estadoMesa === "ver pedidos" && styles.botaoVerPedidos,
  ];

  return (
    <View style={styles.mesaContainer}>
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View
          style={[
            styles.container,
            temPedidosNovos && styles.novoPedido,
            {
              transform: [{ translateX: pan.x }, { translateY: pan.y }],
              opacity: fadeAnim,
            },
          ]}
        >
          <Text style={styles.nome}>{mesa.nomeCliente || "Sem cliente"}</Text>
        </Animated.View>
      </PanGestureHandler>
      <TouchableOpacity style={buttonStyle} onPress={() => onVerPedidos(mesa)}>
        <Text style={styles.botaoTexto}>{estadoMesa.toUpperCase()}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  mesaContainer: { alignItems: "center", margin: 10 },
  container: {
    width: 110,
    height: 90,
    backgroundColor: "#FFA500",
    borderColor: "white",
    borderWidth: 2,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  nome: { fontSize: 18 },
  novoPedido: { borderWidth: 2, borderColor: "#ff4444" },
  botao: { marginTop: 5, padding: 5, borderRadius: 5 },
  botaoFechada: { backgroundColor: "#ff4444" },
  botaoAberta: { backgroundColor: "#007bff" },
  botaoVerPedidos: { backgroundColor: "#28a745" },
  botaoTexto: { color: "#fff", fontSize: 12 },
});
