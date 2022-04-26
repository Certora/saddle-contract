import { HardhatRuntimeEnvironment } from "hardhat/types"
import { DeployFunction } from "hardhat-deploy/types"
import { MULTISIG_ADDRESSES } from "../../utils/accounts"
import { BIG_NUMBER_1E18 } from "../../test/testUtils"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, getChainId, ethers } = hre
  const { deploy, get, getOrNull, execute, read, log } = deployments
  const { deployer } = await getNamedAccounts()

  await deploy("GaugeController", {
    from: deployer,
    log: true,
    skipIfAlreadyDeployed: true,
    args: [
      (await get("SDL")).address,
      (await get("VotingEscrow")).address,
      (await get("DelegationProxy")).address,
      MULTISIG_ADDRESSES[await getChainId()], // admin
    ],
  })

  // read n_gauge_types
  const n_gauge_types = await read("GaugeController", "n_gauge_types")
  if (n_gauge_types.toNumber() < 1) {
    // add a new gauge type
    await execute(
      "GaugeController",
      { from: deployer, log: true },
      "add_type(string,uint256)",
      "Gauge",
      BIG_NUMBER_1E18,
    )
  }

  const minterAddress = (await get("Minter")).address
  const lpTokens = [
    "SaddleALETHPoolLPToken",
    "SaddleBTCPoolV2LPToken",
    "SaddleD4PoolLPToken",
    "SaddleSUSDMetaPoolUpdatedLPToken",
    "SaddleTBTCMetaPoolUpdatedLPToken",
    "SaddleUSDPoolV2LPToken",
    "SaddleWCUSDMetaPoolUpdatedLPToken",
  ]

  for (const lpToken of lpTokens) {
    const deploymentName = `LiquidityGaugeV5_${lpToken}`
    const lpTokenAddress = (await get(lpToken)).address

    if ((await getOrNull(deploymentName)) === null) {
      const result = await deploy(deploymentName, {
        from: deployer,
        log: true,
        skipIfAlreadyDeployed: true,
        contract: "LiquidityGaugeV5",
        args: [
          lpTokenAddress,
          minterAddress,
          MULTISIG_ADDRESSES[await getChainId()],
        ],
      })

      await execute(
        "GaugeController",
        { from: deployer },
        "add_gauge",
        result.address,
        1,
      )
    } else {
      log(
        `${deploymentName} already deployed. Assuming it was already added to GaugeController.`,
      )
    }
  }
}
export default func
