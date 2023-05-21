/********************************************************************************
 * Copyright (c) 2023 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { Deferred } from 'sprotty-protocol';
import { Disposable } from 'vscode-jsonrpc';
import { Action, ActionMessage } from '../../action-protocol';
import { distinctAdd, remove } from '../../utils/array-util';
import { ActionMessageHandler, ClientState, GLSPClient } from '../glsp-client';
import { DisposeClientSessionParameters, InitializeClientSessionParameters, InitializeParameters, InitializeResult } from '../types';
import { GLSPClientProxy, GLSPServer } from './glsp-server';

/**
 * A simple {@link GLSPClient} implementation for use cases where the client & server are running
 * in the same (node) context i.e. process without a communication layer (like json-rpc) between.
 */
export class NodeGLSPClient implements GLSPClient {
    protected state: ClientState;
    protected _server?: GLSPServer;
    protected serverDeferred = new Deferred<GLSPServer>();
    protected onStartDeferred = new Deferred<void>();
    protected onStopDeferred = new Deferred<void>();
    readonly proxy: GLSPClientProxy;
    protected startupTimeout = 1500;
    protected actionMessageHandlers: ActionMessageHandler[] = [];

    constructor(protected options: GLSPClient.Options) {
        this.state = ClientState.Initial;
        this.proxy = this.createProxy();
    }

    protected createProxy(): GLSPClientProxy {
        return {
            process: message => {
                if (this.actionMessageHandlers.length === 0) {
                    console.warn('No ActionMessageHandler is configured- Cannot process server message', message);
                    return;
                }
                [...this.actionMessageHandlers].forEach(handler => handler(message));
            }
        };
    }

    configureServer(server: GLSPServer): void {
        if (this.state === ClientState.Running) {
            throw new Error('Could not configure new server. The GLSPClient is already running');
        }
        this.serverDeferred.resolve(server);
    }

    start(): Promise<void> {
        if (this.state !== ClientState.Initial) {
            return this.onStartDeferred.promise;
        }

        this.state = ClientState.Starting;
        const timeOut = new Promise<GLSPServer>((_, reject) =>
            setTimeout(() => {
                reject(new Error('Could not start client. No server is configured'));
            }, this.startupTimeout)
        );
        Promise.race([this.serverDeferred.promise, timeOut])
            .then(server => {
                this._server = server;
                this.state = ClientState.Running;
                this.onStartDeferred.resolve();
            })
            .catch(error => {
                this.state = ClientState.StartFailed;
                this.onStartDeferred.reject(error);
            });

        return this.onStartDeferred.promise;
    }

    initializeServer(params: InitializeParameters): Promise<InitializeResult> {
        return this.checkedServer.initialize(params);
    }

    initializeClientSession(params: InitializeClientSessionParameters): Promise<void> {
        return this.checkedServer.initializeClientSession(params);
    }

    disposeClientSession(params: DisposeClientSessionParameters): Promise<void> {
        return this.checkedServer.disposeClientSession(params);
    }

    shutdownServer(): void {
        this.checkedServer.shutdown();
    }

    async stop(): Promise<void> {
        if (this.state === ClientState.Stopped || this.state === ClientState.Stopping) {
            return this.onStop();
        }

        this.state = ClientState.Stopping;
        try {
            if (this._server) {
                this._server.shutdown();
            }
        } finally {
            this.state = ClientState.Stopped;
            this.onStopDeferred.resolve();
        }
    }

    sendActionMessage(message: ActionMessage<Action>): void {
        this.checkedServer.process(message);
    }

    onActionMessage(handler: ActionMessageHandler): Disposable {
        distinctAdd(this.actionMessageHandlers, handler);
        return Disposable.create(() => remove(this.actionMessageHandlers, handler));
    }

    get currentState(): ClientState {
        return this.state;
    }

    onStart(): Promise<void> {
        return this.onStartDeferred.promise;
    }

    onStop(): Promise<void> {
        return this.onStopDeferred.promise;
    }

    get id(): string {
        return this.options.id;
    }

    protected checkState(): void | never {
        if (this.state !== ClientState.Running) {
            throw new Error(`Client with id '${this.id}' is not in 'Running' state`);
        }
    }

    protected get checkedServer(): GLSPServer {
        this.checkState();
        if (!this._server) {
            throw new Error(`No server is configured for GLSPClient with id '${this.id}'`);
        }
        return this._server;
    }

    setStartupTimeout(ms: number): void {
        this.startupTimeout = ms;
    }
}