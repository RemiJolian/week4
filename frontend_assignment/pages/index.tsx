import React from "react";
import { Box, TextField, Stack, Button, Alert } from "@mui/material";

import detectEthereumProvider from "@metamask/detect-provider";
import { Strategy, ZkIdentity } from "@zk-kit/identity";
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols";
import { Contract, providers, utils } from "ethers";
import Head from "next/head";

import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import styles from "../styles/Home.module.css";
import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json";

const schema = yup
  .object({
    fullName: yup.string().required("Name required"),
    address: yup.string().required("Address required"),
    age: yup.number().positive().integer().required("Age required"),
  })
  .required();

interface Data extends yup.InferType<typeof schema> {}

const defaultValues: Data = {
  fullName: "",
  address: "",
  age: 0,
};

const alphaRegex = /^[A-Za-z]+$/i;

export default function Home() {
  const [logs, setLogs] = React.useState("Connect your wallet and greet!");
  const [greeting, setGreeting] = React.useState("");
  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<Data>({
    defaultValues,
    resolver: yupResolver(schema),
  });

  React.useEffect(() => {
    let ethersProvider: any = null;
    let contract: any = null;
    const listenEvent = async () => {
      const provider = (await detectEthereumProvider()) as any;

      await provider.request({ method: "eth_requestAccounts" });
      ethersProvider = new providers.Web3Provider(provider);
      contract = new Contract(
        "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
        Greeter.abi,
        ethersProvider
      );

      contract.on("NewGreeting", (greeting: any, event: any) => {
        setGreeting(utils.toUtf8String(greeting));
      });
    };
    listenEvent();
    return () => {
      contract?.removeAllListeners();
    };
  }, []);

  async function greet(data: Data) {
    setLogs("Creating your Semaphore identity...");

    const provider = (await detectEthereumProvider()) as any;

    await provider.request({ method: "eth_requestAccounts" });
    const ethersProvider = new providers.Web3Provider(provider);
    const signer = ethersProvider.getSigner();
    const message = await signer.signMessage(
      "Sign this message to create your identity!"
    );

    const identity = new ZkIdentity(Strategy.MESSAGE, message);
    const identityCommitment = identity.genIdentityCommitment();
    const identityCommitments = await (
      await fetch("./identityCommitments.json")
    ).json();

    const merkleProof = generateMerkleProof(
      20,
      BigInt(0),
      identityCommitments,
      identityCommitment
    );

    setLogs("Creating your Semaphore proof...");

    const greeting = "Hello world";

    const witness = Semaphore.genWitness(
      identity.getTrapdoor(),
      identity.getNullifier(),
      merkleProof,
      merkleProof.root,
      greeting
    );

    const { proof, publicSignals } = await Semaphore.genProof(
      witness,
      "./semaphore.wasm",
      "./semaphore_final.zkey"
    );
    const solidityProof = Semaphore.packToSolidityProof(proof);

    const response = await fetch("/api/greet", {
      method: "POST",
      body: JSON.stringify({
        greeting,
        nullifierHash: publicSignals.nullifierHash,
        solidityProof: solidityProof,
      }),
    });

    if (response.status === 500) {
      const errorMessage = await response.text();

      setLogs(errorMessage);
    } else {
      console.log(JSON.stringify(data));
      setLogs("Your anonymous greeting is onchain :)");
    }
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Greetings</title>
        <meta
          name="description"
          content="A simple Next.js/Hardhat privacy application with Semaphore."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>Greetings</h1>

        <p className={styles.description}>
          A simple Next.js/Hardhat privacy application with Semaphore.
        </p>

        <div className={styles.logs}>{logs}</div>
        <Box>
          {!greeting ? (
            <form onSubmit={handleSubmit(greet)}>
              <Stack spacing={2} flex={1} alignItems="center">
                <Stack direction="row" spacing={2}>
                  <Box>
                    <Controller
                      name="fullName"
                      control={control}
                      render={({ field: { onChange, onBlur, value } }) => (
                        <TextField
                          value={value}
                          onChange={onChange}
                          onBlur={onBlur}
                          label="Full Name"
                          fullWidth
                          inputProps={{ "aria-label": "Full Name" }}
                        />
                      )}
                    />
                    {errors.fullName && (
                      <Alert variant="outlined" severity="error">
                        {errors.fullName?.message}
                      </Alert>
                    )}
                  </Box>

                  <Box>
                    <Controller
                      name="address"
                      control={control}
                      render={({ field: { onChange, value } }) => (
                        <TextField
                          value={value}
                          onChange={onChange}
                          label="Address"
                          inputProps={{ "aria-label": "Address" }}
                        />
                      )}
                      rules={{
                        pattern: {
                          value: alphaRegex,
                          message: "Enter valid Address",
                        },
                        maxLength: 200,
                        required: "Address required",
                      }}
                    />
                    {errors.address && (
                      <Alert variant="outlined" severity="error">
                        {errors.address.message}
                      </Alert>
                    )}
                  </Box>

                  <Box>
                    <Controller
                      name="age"
                      control={control}
                      render={({ field: { onChange, onBlur, value } }) => (
                        <TextField
                          value={value}
                          onChange={onChange}
                          onBlur={onBlur}
                          label="Age"
                          type="number"
                          inputProps={{ "aria-label": "age" }}
                        />
                      )}
                      rules={{
                        required: "Age required",
                      }}
                    />
                    {errors.age && (
                      <Alert variant="outlined" severity="error">
                        {errors.age.message}
                      </Alert>
                    )}
                  </Box>
                </Stack>

                <Button
                  type="submit"
                  size="large"
                  variant="contained"
                  sx={{ width: 1 / 2 }}
                >
                  Greet
                </Button>
              </Stack>
            </form>
          ) : (
            <Box mt={2} justifyContent="center">
              <TextField
                id="outlined-basic"
                label="Greeting"
                variant="outlined"
                InputProps={{
                  readOnly: true,
                }}
                value={greeting}
              />
            </Box>
          )}
        </Box>
      </main>
    </div>
  );
}
